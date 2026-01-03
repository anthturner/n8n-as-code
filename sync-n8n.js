require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chokidar = require('chokidar');
const deepEqual = require('deep-equal');

// --- CONFIGURATION ---
const N8N_HOST = process.env.N8N_HOST;
const API_KEY = process.env.N8N_API_KEY;
const WATCH_DIR = './synced_workflows'; // Dossier de travail
const POLLING_INTERVAL = 3000; // Vérifie n8n toutes les 3s

// Vérifications
if (!N8N_HOST || !API_KEY) {
    console.error("❌ ERREUR: Variables manquantes dans le .env");
    process.exit(1);
}
if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR);

// État
let workflowMap = new Map();
let isWritingFromRemote = false; // Le verrou pour éviter la boucle infinie

// --- FONCTIONS UTILITAIRES ---

// Nettoie le workflow pour ne garder que la logique (pour la comparaison et l'envoi)
function cleanWorkflow(data) {
    return {
        name: data.name,
        nodes: data.nodes,
        connections: data.connections,
        settings: data.settings
        // On ignore volontairement : id, active, tags, pinData, meta, versionId
    };
}

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
    
    // Mise à jour de l'annuaire (Nom -> ID)
    workflowMap.clear();
    workflows.forEach(wf => workflowMap.set(wf.name, wf.id));

    const files = fs.readdirSync(WATCH_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
        const name = path.parse(file).name;
        const id = workflowMap.get(name);
        
        if (!id) continue; // Le workflow n'existe pas encore dans n8n, on ignore

        const remoteWorkflow = await fetchWorkflowDetails(id);
        if (!remoteWorkflow) continue;

        const filePath = path.join(WATCH_DIR, file);
        let localJson;
        try { localJson = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { continue; }

        // On compare uniquement ce qui compte (nodes, connections...)
        const remoteClean = cleanWorkflow(remoteWorkflow);
        const localClean = cleanWorkflow(localJson);

        if (!deepEqual(remoteClean, localClean)) {
            console.log(`⬇️  Modif détectée dans n8n sur "${name}". Mise à jour du fichier...`);
            
            isWritingFromRemote = true; // 🔒 VERROUILLAGE
            fs.writeFileSync(filePath, JSON.stringify(remoteWorkflow, null, 2));
            
            // On déverrouille après 1 seconde
            setTimeout(() => { isWritingFromRemote = false; }, 1000);
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
    // Si c'est le script lui-même qui vient d'écrire, on ne fait rien
    if (isWritingFromRemote) return;
    if (!filePath.endsWith('.json')) return;

    const filename = path.basename(filePath);
    const name = path.parse(filename).name;
    let id = workflowMap.get(name);

    // Si on ne connait pas l'ID, on tente un refresh rapide de l'annuaire
    if (!id) { await pollN8n(); id = workflowMap.get(name); }
    
    if (!id) {
        console.warn(`⚠️  Workflow "${name}" introuvable dans n8n. Créez-le d'abord dans l'interface ou vérifiez le nom.`);
        return;
    }

    console.log(`⬆️  Sauvegarde locale de "${name}" -> Envoi vers n8n...`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        
        // On nettoie avant d'envoyer pour éviter les erreurs 400
        const cleanData = cleanWorkflow(json);

        await axios.put(`${N8N_HOST}/api/v1/workflows/${id}`, cleanData, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        
        console.log(`✅ Succès ! (ID: ${id})`);
        // Astuce : Affiche l'URL cliquable dans le terminal (CMD+Click)
        console.log(`🔗 ${N8N_HOST}/workflow/${id}`);

    } catch (e) {
        if (e.response) {
             console.error(`❌ Erreur API n8n (${e.response.status}):`, e.response.data.message);
        } else {
             console.error(`❌ Erreur:`, e.message);
        }
    }
});

// --- LANCEMENT ---
console.log(`🤖 Système de Synchro Bidirectionnelle Actif`);
console.log(`📂 Dossier : ${WATCH_DIR}`);
console.log(`📡 Polling n8n : toutes les ${POLLING_INTERVAL/1000}s`);

pollN8n(); // Premier scan au démarrage
setInterval(pollN8n, POLLING_INTERVAL); // Boucle