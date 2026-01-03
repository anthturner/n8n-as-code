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
const POLLING_INTERVAL = 3000; // Vérifie n8n toutes les 3 secondes

if (!N8N_HOST || !API_KEY) {
    console.error("❌ ERREUR: Variables manquantes dans le .env");
    process.exit(1);
}
if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR);

// --- ÉTAT GLOBAL ---
let workflowMap = new Map(); // Nom -> ID
let isWritingFromRemote = false; // LE VERROU CRITIQUE

// Fonction de nettoyage pour comparaison (on garde l'essentiel)
function cleanWorkflow(data) {
    return {
        name: data.name,
        nodes: data.nodes,
        connections: data.connections,
        settings: data.settings
        // On ignore tags, pinData, active, id, meta, etc. pour la comparaison
    };
}

// --- 1. FONCTIONS API ---

async function fetchAllWorkflows() {
    try {
        const response = await axios.get(`${N8N_HOST}/api/v1/workflows`, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        return response.data.data;
    } catch (error) {
        console.error("⚠️ Erreur polling n8n:", error.message);
        return [];
    }
}

async function fetchWorkflowDetails(id) {
    try {
        const response = await axios.get(`${N8N_HOST}/api/v1/workflows/${id}`, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

async function pushToN8n(id, data) {
    const cleanData = cleanWorkflow(data);
    await axios.put(`${N8N_HOST}/api/v1/workflows/${id}`, cleanData, {
        headers: { 'X-N8N-API-KEY': API_KEY }
    });
}

// --- 2. LE POLLERS (N8N -> LOCAL) ---

async function pollN8n() {
    const workflows = await fetchAllWorkflows();
    
    // Mise à jour de l'annuaire
    workflowMap.clear();
    workflows.forEach(wf => workflowMap.set(wf.name, wf.id));

    // Pour chaque fichier local, on vérifie si la version distante est plus récente/différente
    const files = fs.readdirSync(WATCH_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
        const name = path.parse(file).name;
        const id = workflowMap.get(name);
        if (!id) continue;

        // On récupère le workflow complet depuis n8n
        const remoteWorkflow = await fetchWorkflowDetails(id);
        if (!remoteWorkflow) continue;

        // On lit le local
        const filePath = path.join(WATCH_DIR, file);
        let localJson;
        try {
            localJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) { continue; } // Fichier en cours d'écriture ou invalide

        // COMPARAISON MAGIQUE
        const remoteClean = cleanWorkflow(remoteWorkflow);
        const localClean = cleanWorkflow(localJson);

        // Si c'est différent, n8n a gagné -> on met à jour le local
        if (!deepEqual(remoteClean, localClean)) {
            console.log(`⬇️  Modif détectée dans n8n pour "${name}". Mise à jour locale...`);
            
            // 🔒 ON ACTIVE LE VERROU
            isWritingFromRemote = true;
            
            // On écrit le fichier proprement formaté (prettify)
            fs.writeFileSync(filePath, JSON.stringify(remoteWorkflow, null, 2));
            
            // On relâche le verrou après un court délai pour laisser chokidar ignorer l'event
            setTimeout(() => { isWritingFromRemote = false; }, 1000);
        }
    }
}

// --- 3. LE WATCHER (LOCAL -> N8N) ---

console.log(`🔁 Sync Bidirectionnelle Active (Polling: ${POLLING_INTERVAL}ms)`);

// Initialisation immédiate
pollN8n(); 
// Lancement de la boucle infinie de polling
setInterval(pollN8n, POLLING_INTERVAL);

// Surveillance disque avec Chokidar
const watcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\/\\])\../, 
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

watcher.on('change', async (filePath) => {
    // 🔒 SI LE VERROU EST ACTIF, C'EST NOUS QUI ÉCRIVONS -> ON IGNORE
    if (isWritingFromRemote) return;

    if (!filePath.endsWith('.json')) return;

    const filename = path.basename(filePath);
    const name = path.parse(filename).name;
    let id = workflowMap.get(name);

    // Si ID inconnu, petit refresh rapide au cas où
    if (!id) {
        await pollN8n();
        id = workflowMap.get(name);
    }

    if (!id) {
        console.log(`⚠️ Workflow local "${name}" introuvable dans n8n. (Créez-le dans n8n d'abord ou attendez le prochain poll)`);
        return;
    }

    console.log(`⬆️  Sauvegarde locale de "${name}" -> Envoi vers n8n...`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        
        await pushToN8n(id, json);
        console.log(`✅ n8n mis à jour !`);
        
    } catch (e) {
        console.error(`❌ Erreur d'envoi : ${e.message}`);
    }
});