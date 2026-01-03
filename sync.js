require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chokidar = require('chokidar');
const deepEqual = require('deep-equal');

// =============================================================================
// 1. CONFIGURATION
// =============================================================================
const CONFIG = {
    host: process.env.N8N_HOST,
    apiKey: process.env.N8N_API_KEY,
    dir: './synced_workflows',
    pollInterval: 3000,
    
    // ⚙️ RETOUR ARRIÈRE : On synchronise TOUT (même les inactifs)
    // Cela permet de récupérer les duplications faites dans n8n (qui sont inactives par défaut)
    syncInactiveWorkflows: true, 
    
    // On garde le filtre par tags pour l'archivage explicite si besoin
    ignoredTags: ['archive', 'archived', 'archivé'] 
};

if (!CONFIG.host || !CONFIG.apiKey) {
    console.error("❌ ERREUR: Variables .env manquantes (N8N_HOST, N8N_API_KEY)");
    process.exit(1);
}
if (!fs.existsSync(CONFIG.dir)) fs.mkdirSync(CONFIG.dir);

// =============================================================================
// 2. STATE MANAGER
// =============================================================================
const State = {
    fileToId: new Map(),
    selfWritten: new Map(),
    
    register(filename, id) {
        this.fileToId.set(filename, id);
    },
    
    getId(filename) {
        return this.fileToId.get(filename);
    },

    markAsSelfWritten(filePath, content) {
        this.selfWritten.set(filePath, content);
    },

    isSelfWritten(filePath, currentContent) {
        if (!this.selfWritten.has(filePath)) return false;
        return this.selfWritten.get(filePath) === currentContent;
    }
};

// =============================================================================
// 3. TOOLING
// =============================================================================
const Tools = {
    safeName(name) {
        return name.replace(/[\/\\:]/g, '_').replace(/\s+/g, ' ').trim();
    },

    shouldIgnore(workflow) {
        // 1. Si on a décidé d'ignorer les inactifs (CONFIG)
        if (CONFIG.syncInactiveWorkflows === false && workflow.active === false) {
            return true;
        }

        // 2. Vérification des Tags
        const tags = workflow.tags || [];
        const hasIgnoredTag = tags.some(t => t.name && CONFIG.ignoredTags.includes(t.name.toLowerCase()));
        if (hasIgnoredTag) return true;

        return false;
    },

    cleanForStorage(data) {
        const settings = { ...(data.settings || {}) };
        const keysToRemove = [
            'availableInMCP', 'callerPolicy', 'saveDataErrorExecution',
            'saveManualExecutions', 'saveExecutionProgress', 'executionOrder'
        ];
        keysToRemove.forEach(k => delete settings[k]);

        return {
            name: data.name,
            nodes: data.nodes || [],
            connections: data.connections || {},
            settings: settings,
            tags: data.tags || [],
            active: data.active 
        };
    },

    cleanForPush(data) {
        const clean = this.cleanForStorage(data);
        delete clean.active; 
        delete clean.tags;   
        return clean;
    }
};

// =============================================================================
// 4. API SERVICE
// =============================================================================
const API = {
    headers: { 'X-N8N-API-KEY': CONFIG.apiKey },

    async getAll() {
        try {
            const res = await axios.get(`${CONFIG.host}/api/v1/workflows`, { headers: this.headers });
            return res.data.data;
        } catch (e) {
            console.error("❌ Erreur API:", e.message);
            return [];
        }
    },

    async getOne(id) {
        try {
            const res = await axios.get(`${CONFIG.host}/api/v1/workflows/${id}`, { headers: this.headers });
            return res.data;
        } catch (e) { return null; }
    },

    async create(payload) {
        const res = await axios.post(`${CONFIG.host}/api/v1/workflows`, payload, { headers: this.headers });
        return res.data;
    }
    ,
    async update(id, payload) {
        const res = await axios.put(`${CONFIG.host}/api/v1/workflows/${id}`, payload, { headers: this.headers });
        return res.data;
    }
};

// =============================================================================
// 5. FILE SYSTEM
// =============================================================================
const FS = {
    read(filePath) {
        try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { return null; }
    },
    readRaw(filePath) {
        try { return fs.readFileSync(filePath, 'utf8'); } catch (e) { return null; }
    },
    write(filePath, data) {
        const content = JSON.stringify(data, null, 2);
        State.markAsSelfWritten(filePath, content);
        fs.writeFileSync(filePath, content);
    },
    exists(filePath) { return fs.existsSync(filePath); },
    listJsonFiles() {
        return fs.readdirSync(CONFIG.dir).filter(f => f.endsWith('.json'));
    }
};

// =============================================================================
// 6. SYNC ENGINE
// =============================================================================

// A. Logique Descendante (n8n -> Local)
async function syncDown() {
    let remoteWorkflows = await API.getAll();

    // 1. Tri : Actifs d'abord (Priorité de nommage)
    // C'est important si "MonWorkflow" (Actif) et "MonWorkflow" (Inactif) existent en même temps
    remoteWorkflows.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));

    const cycleMap = new Map();

    for (const wf of remoteWorkflows) {
        const filename = `${Tools.safeName(wf.name)}.json`;
        
        // Anti-collision : Si le fichier est déjà pris par un workflow prioritaire (Actif), on passe.
        if (cycleMap.has(filename)) continue; 
        
        cycleMap.set(filename, wf.id);
        State.register(filename, wf.id);

        // Filtre (Tags uniquement désormais, puisque syncInactiveWorkflows est true)
        if (Tools.shouldIgnore(wf)) continue; 

        const filePath = path.join(CONFIG.dir, filename);
        const fullWf = await API.getOne(wf.id);
        if (!fullWf) continue;

        const cleanRemote = Tools.cleanForStorage(fullWf);

        // Création
        if (!FS.exists(filePath)) {
            console.log(`📥 [n8n->Local] Nouveau : "${filename}"`);
            FS.write(filePath, cleanRemote);
            continue;
        }

        // Mise à jour
        const localData = FS.read(filePath);
        if (!localData) continue;

        const cleanLocal = Tools.cleanForStorage(localData);
        if (!deepEqual(cleanLocal, cleanRemote)) {
            console.log(`📥 [n8n->Local] Mise à jour : "${filename}"`);
            FS.write(filePath, cleanRemote);
        }
    }
}

// B. Logique Montante (Local -> n8n) - Initiale
async function syncUpMissing() {
    const localFiles = FS.listJsonFiles();
    
    for (const file of localFiles) {
        if (State.getId(file)) continue;

        const filePath = path.join(CONFIG.dir, file);
        const localData = FS.read(filePath);
        if (!localData) continue;

        console.log(`📤 [Local->n8n] Init - Création orphelin : "${file}"`);
        
        try {
            const payload = Tools.cleanForPush(localData);
            
            // SÉCURITÉ ANTI-DOUBLON (Nom fichier vs Nom interne)
            const nameFromFile = path.parse(file).name;
            const safePayloadName = Tools.safeName(payload.name || '');
            
            if (safePayloadName !== nameFromFile) {
                console.log(`⚠️  Nom JSON "${payload.name}" != Fichier "${file}". Correction auto.`);
                payload.name = nameFromFile;
            } else {
                payload.name = payload.name || nameFromFile;
            }

            const newWf = await API.create(payload);
            console.log(`✅ Créé (ID: ${newWf.id})`);
            State.register(file, newWf.id);
        } catch (e) {
            console.error(`❌ Echec création "${file}":`, e.response?.data?.message || e.message);
        }
    }
}

// C. Gestionnaire Watcher
async function handleLocalEvent(filePath) {
    if (!filePath.endsWith('.json')) return;

    const rawContent = FS.readRaw(filePath);
    if (!rawContent) return; 
    if (State.isSelfWritten(filePath, rawContent)) return;

    const filename = path.basename(filePath);
    const nameFromFile = path.parse(filename).name;
    let id = State.getId(filename);

    const json = JSON.parse(rawContent);
    const payload = Tools.cleanForPush(json);

    try {
        if (id) {
            // UPDATE
            const remoteRaw = await API.getOne(id);
            if (remoteRaw) {
                const remoteClean = Tools.cleanForStorage(remoteRaw);
                const localClean = Tools.cleanForStorage(json);
                if (deepEqual(remoteClean, localClean)) return;
            }

            if (!payload.name) payload.name = nameFromFile;
            
            console.log(`📤 [Local->n8n] Update : "${filename}"`);
            await API.update(id, payload);
            console.log(`✅ Update OK`);

        } else {
            // CREATE
            const safePayloadName = Tools.safeName(payload.name || '');
            
            if (safePayloadName !== nameFromFile) {
                console.log(`⚠️  Mismatch Nom : "${payload.name}" ignoré au profit de "${nameFromFile}".`);
                payload.name = nameFromFile;
            } else {
                payload.name = payload.name || nameFromFile;
            }

            console.log(`✨ [Local->n8n] Création : "${filename}"`);
            const newWf = await API.create(payload);
            console.log(`✅ Créé (ID: ${newWf.id})`);
            State.register(filename, newWf.id);
        }
    } catch (e) {
        console.error(`❌ Erreur Sync Montante:`, e.response?.data?.message || e.message);
    }
}

// =============================================================================
// 7. MAIN
// =============================================================================
(async () => {
    console.log(`🚀 Démarrage de n8n-as-code...`);
    
    console.log(`🔄 Init 1/2: Scan n8n...`);
    await syncDown();

    console.log(`🔄 Init 2/2: Vérification orphelins...`);
    await syncUpMissing();

    console.log(`👀 Surveillance active...`);
    const watcher = chokidar.watch(CONFIG.dir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true, 
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    });

    watcher
        .on('change', (p) => handleLocalEvent(p))
        .on('add', (p) => handleLocalEvent(p));

    setInterval(async () => {
        await syncDown();
    }, CONFIG.pollInterval);

    console.log(`✅ Prêt !`);
})();