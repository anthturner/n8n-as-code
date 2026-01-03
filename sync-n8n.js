require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chokidar = require('chokidar');
const deepEqual = require('deep-equal');

// --- CONFIGURATION ---
const N8N_HOST = process.env.N8N_HOST;
const API_KEY = process.env.N8N_API_KEY;
const WATCH_DIR = './synced_workflows'; 
const POLLING_INTERVAL = 3000; 

if (!N8N_HOST || !API_KEY) process.exit(1);
if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR);

let workflowMap = new Map();
// Mémoire tampon pour empêcher l'écho immédiat quand le script écrit lui-même
let selfWrittenContent = new Map(); 

// --- LE CŒUR DU SYSTÈME : LE FILTRE ---

function cleanForStorage(data) {
    // 1. Nettoyage du bruit dans les settings
    // On copie l'objet pour ne pas muter la source
    const settings = { ...(data.settings || {}) };
    
    // 🔇 LISTE NOIRE : Ce qui change tout seul ou qu'on ne veut pas dans Git
    delete settings.availableInMCP;
    delete settings.callerPolicy;
    delete settings.saveDataErrorExecution;
    delete settings.saveManualExecutions;
    delete settings.saveExecutionProgress;
    delete settings.executionOrder; // Souvent ajouté par défaut (v1)

    // 2. Construction de l'objet "Pur"
    return {
        name: data.name,
        nodes: data.nodes || [],
        connections: data.connections || {},
        settings: settings,
        tags: data.tags || [],
        active: data.active
        // ⛔️ ON SUPPRIME RADICALEMENT TOUT CE QUI EST VERSIONNING
        // Pas de versionId, pas de meta, pas de staticData, pas de pinData
    };
}

// --- API ---

async function fetchAllWorkflows() {
    try {
        const res = await axios.get(`${N8N_HOST}/api/v1/workflows`, { headers: { 'X-N8N-API-KEY': API_KEY } });
        return res.data.data;
    } catch (e) { return []; }
}

async function fetchWorkflowDetails(id) {
    try {
        const res = await axios.get(`${N8N_HOST}/api/v1/workflows/${id}`, { headers: { 'X-N8N-API-KEY': API_KEY } });
        return res.data;
    } catch (e) { return null; }
}

// --- 1. SYNCHRO DESCENDANTE (N8N -> DISQUE) ---

async function pollN8n() {
    const workflows = await fetchAllWorkflows();
    workflowMap.clear();
    workflows.forEach(wf => workflowMap.set(wf.name, wf.id));

    for (const [name, id] of workflowMap) {
        const safeName = name.replace(/[\/\\:]/g, '_');
        const filePath = path.join(WATCH_DIR, `${safeName}.json`);

        // Récupération de la version n8n (Brute)
        const remoteRaw = await fetchWorkflowDetails(id);
        if (!remoteRaw) continue;

        // 🧹 ON NETTOIE IMMÉDIATEMENT
        // On ne travaille plus jamais avec la version brute qui contient le versionId
        const remoteClean = cleanForStorage(remoteRaw);
        const remoteString = JSON.stringify(remoteClean, null, 2);

        // A. Cas : Initialisation (Fichier absent)
        if (!fs.existsSync(filePath)) {
            console.log(`✨ Init: "${name}"`);
            selfWrittenContent.set(filePath, remoteString);
            fs.writeFileSync(filePath, remoteString);
            continue;
        }

        // B. Cas : Vérification de mise à jour
        let localJson;
        try { localJson = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { continue; }
        
        // On nettoie aussi le local (au cas où il y aurait des restes)
        const localClean = cleanForStorage(localJson);

        // COMPARATOR : On compare "Propre" vs "Propre"
        if (!deepEqual(localClean, remoteClean)) {
            console.log(`⬇️  Modif n8n (LogicOnly) sur "${name}". Mise à jour locale...`);
            
            // 💾 ÉCRITURE : On écrit la version NETTOYÉE (sans versionId)
            selfWrittenContent.set(filePath, remoteString);
            fs.writeFileSync(filePath, remoteString);
        }
    }
}

// --- 2. SYNCHRO MONTANTE (DISQUE -> N8N) ---

const watcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

watcher.on('change', async (filePath) => {
    if (!filePath.endsWith('.json')) return;

    // --- 🛡️ Protection Anti-Echo ---
    let currentContent;
    try { currentContent = fs.readFileSync(filePath, 'utf8'); } catch (e) { return; }

    if (selfWrittenContent.has(filePath)) {
        if (currentContent === selfWrittenContent.get(filePath)) return;
    }
    // -------------------------------

    const filename = path.basename(filePath);
    const nameFromFile = path.parse(filename).name;
    let id = workflowMap.get(nameFromFile);

    if (!id) { await pollN8n(); id = workflowMap.get(nameFromFile); }
    if (!id) return;

    console.log(`⬆️  Push local: "${nameFromFile}"`);

    try {
        const json = JSON.parse(currentContent);
        // On s'assure d'envoyer un format propre (le filtre fait aussi office de validateur)
        const payload = cleanForStorage(json);

        await axios.put(`${N8N_HOST}/api/v1/workflows/${id}`, payload, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        
        console.log(`✅ Succès !`);
        // On ne met PAS à jour le fichier local. 
        // Le prochain Poll va comparer [Local] vs [RemoteNettoyé].
        // Comme la logique est la même, ils seront égaux => Pas d'écriture => Pas de Git sale.

    } catch (e) {
        if (e.response) console.error(`❌ Erreur API:`, e.response.data.message);
        else console.error(`❌ Erreur:`, e.message);
    }
});

console.log(`🤖 GitOps Sync Actif (Mode "No Noise")`);
pollN8n();
setInterval(pollN8n, POLLING_INTERVAL);