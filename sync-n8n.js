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
let selfWrittenContent = new Map(); 

// --- FILTRE (Stockage Local) ---
// Garde le JSON propre pour le disque et Git
function cleanForStorage(data) {
    const settings = { ...(data.settings || {}) };
    
    // Nettoyage du bruit
    delete settings.availableInMCP;
    delete settings.callerPolicy;
    delete settings.saveDataErrorExecution;
    delete settings.saveManualExecutions;
    delete settings.saveExecutionProgress;
    delete settings.executionOrder;

    return {
        name: data.name,
        nodes: data.nodes || [],
        connections: data.connections || {},
        settings: settings,
        tags: data.tags || [],
        active: data.active // On le GARDE sur le disque pour info
        // Pas de versionId, pas de meta
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

        const remoteRaw = await fetchWorkflowDetails(id);
        if (!remoteRaw) continue;

        // Nettoyage pour stockage
        const remoteClean = cleanForStorage(remoteRaw);
        const remoteString = JSON.stringify(remoteClean, null, 2);

        // Init ou Update
        if (!fs.existsSync(filePath)) {
            console.log(`✨ Init: "${name}"`);
            selfWrittenContent.set(filePath, remoteString);
            fs.writeFileSync(filePath, remoteString);
            continue;
        }

        let localJson;
        try { localJson = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { continue; }
        
        const localClean = cleanForStorage(localJson);

        if (!deepEqual(localClean, remoteClean)) {
            console.log(`⬇️  Modif n8n (LogicOnly) sur "${name}". Mise à jour locale...`);
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

    // Anti-Echo
    let currentContent;
    try { currentContent = fs.readFileSync(filePath, 'utf8'); } catch (e) { return; }

    if (selfWrittenContent.has(filePath)) {
        if (currentContent === selfWrittenContent.get(filePath)) return;
    }

    const filename = path.basename(filePath);
    const nameFromFile = path.parse(filename).name;
    let id = workflowMap.get(nameFromFile);

    if (!id) { await pollN8n(); id = workflowMap.get(nameFromFile); }
    if (!id) return;

    console.log(`⬆️  Push local: "${nameFromFile}"`);

    try {
        const json = JSON.parse(currentContent);
        
        // Préparation Payload
        const payload = cleanForStorage(json);
        
        // ✂️ NETTOYAGE CRITIQUE POUR L'API ✂️
        delete payload.active; // L'API refuse qu'on touche à ça ici
        delete payload.tags;   // Idem

        await axios.put(`${N8N_HOST}/api/v1/workflows/${id}`, payload, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        
        console.log(`✅ Succès !`);

    } catch (e) {
        if (e.response) console.error(`❌ Erreur API:`, e.response.data.message);
        else console.error(`❌ Erreur:`, e.message);
    }
});

console.log(`🤖 GitOps Sync Actif (Fix "Active Read-Only")`);
pollN8n();
setInterval(pollN8n, POLLING_INTERVAL);