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

if (!N8N_HOST || !API_KEY) {
    console.error("❌ ERREUR: Variables manquantes dans le .env");
    process.exit(1);
}
if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR);

let workflowMap = new Map();
let isWritingFromRemote = false;

// --- FONCTIONS UTILITAIRES ---

function cleanWorkflow(data) {
    return {
        name: data.name,
        nodes: data.nodes || [],
        connections: data.connections || {},
        settings: data.settings || {}
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

// --- 1. SYNCHRO DESCENDANTE & INITIALISATION (N8N -> DISQUE) ---

async function pollN8n() {
    const workflows = await fetchAllWorkflows();
    
    // Mise à jour de l'annuaire
    workflowMap.clear();
    workflows.forEach(wf => workflowMap.set(wf.name, wf.id));

    // ON BOUCLE SUR LES WORKFLOWS DISTANTS (C'est ça le changement majeur)
    for (const [name, id] of workflowMap) {
        
        // On construit le nom de fichier attendu
        // Attention : Si votre nom contient des "/" ou ":", ça peut poser problème sur Windows/Mac
        const safeName = name.replace(/[\/\\:]/g, '_'); 
        const fileName = `${safeName}.json`;
        const filePath = path.join(WATCH_DIR, fileName);

        // Cas 1 : Le fichier n'existe pas -> ON L'INITIALISE
        if (!fs.existsSync(filePath)) {
            console.log(`✨ Nouveau workflow n8n trouvé : "${name}". Création du fichier local...`);
            const remoteWorkflow = await fetchWorkflowDetails(id);
            if (remoteWorkflow) {
                isWritingFromRemote = true;
                fs.writeFileSync(filePath, JSON.stringify(remoteWorkflow, null, 2));
                setTimeout(() => { isWritingFromRemote = false; }, 1000);
            }
            continue; // On passe au suivant
        }

        // Cas 2 : Le fichier existe -> ON VÉRIFIE LES MISES À JOUR
        const remoteWorkflow = await fetchWorkflowDetails(id);
        if (!remoteWorkflow) continue;

        let localJson;
        try { localJson = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { continue; }

        const remoteClean = cleanWorkflow(remoteWorkflow);
        const localClean = cleanWorkflow(localJson);

        if (!deepEqual(remoteClean, localClean)) {
            console.log(`⬇️  Modif n8n sur "${name}". Mise à jour locale...`);
            isWritingFromRemote = true;
            fs.writeFileSync(filePath, JSON.stringify(remoteWorkflow, null, 2));
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
    if (isWritingFromRemote) return;
    if (!filePath.endsWith('.json')) return;

    const filename = path.basename(filePath);
    // On enlève l'extension pour retrouver le nom
    const nameFromFile = path.parse(filename).name; 
    
    // Note : Si vous avez des noms avec caractères spéciaux remplacés par "_", 
    // la correspondance inverse peut être délicate. 
    // Idéalement, gardez des noms simples dans n8n.
    
    let id = workflowMap.get(nameFromFile);

    // Tentative de refresh si ID inconnu
    if (!id) { await pollN8n(); id = workflowMap.get(nameFromFile); }
    
    if (!id) {
        // C'est peut-être un fichier que vous venez de créer manuellement ?
        // Pour l'instant on ignore pour éviter de créer des doublons par erreur
        console.warn(`⚠️  Workflow local "${nameFromFile}" non lié. (ID introuvable dans n8n)`);
        return;
    }

    console.log(`⬆️  Sauvegarde locale de "${nameFromFile}" -> Envoi vers n8n...`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        const cleanData = cleanWorkflow(json);

        await axios.put(`${N8N_HOST}/api/v1/workflows/${id}`, cleanData, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        
        console.log(`✅ Succès !`);
        console.log(`🔗 ${N8N_HOST}/workflow/${id}`);

    } catch (e) {
        if (e.response) {
             console.error(`❌ Erreur API (${e.response.status}):`, e.response.data.message);
        } else {
             console.error(`❌ Erreur:`, e.message);
        }
    }
});

// --- LANCEMENT ---
console.log(`🤖 Système Full-Sync (Init + Bidirectionnel) Actif`);
console.log(`📂 Dossier : ${WATCH_DIR}`);

pollN8n(); // Au lancement, ceci va télécharger TOUS vos workflows manquants
setInterval(pollN8n, POLLING_INTERVAL);