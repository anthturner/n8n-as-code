// On charge les variables d'environnement tout en haut
require('dotenv').config();

const fs = require('fs');
const axios = require('axios');

// --- RÉCUPÉRATION ET VÉRIFICATION DES VARIABLES ---
const N8N_HOST = process.env.N8N_HOST;
const API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = process.env.N8N_WORKFLOW_ID;
// On utilise une valeur par défaut si la variable n'est pas définie dans le .env
const LOCAL_FILE = process.env.LOCAL_FILE_PATH || './AI_Job_Hunter.json';

// Petit check de sécurité au démarrage
if (!N8N_HOST || !API_KEY || !WORKFLOW_ID) {
    console.error("❌ ERREUR: Variables manquantes dans le fichier .env (N8N_HOST, N8N_API_KEY ou N8N_WORKFLOW_ID)");
    process.exit(1);
}

console.log(`--- 🤖 Synchronisation Active ---`);
console.log(`📡 Cible n8n   : ${N8N_HOST} (Workflow #${WORKFLOW_ID})`);
console.log(`📂 Fichier local : ${LOCAL_FILE}`);

// --- LOGIQUE DE SURVEILLANCE ---

// Note: fs.watchFile vérifie périodiquement (polling). 
// Pour un script en prod, 'chokidar' ou 'fs.watch' est souvent plus réactif, 
// mais watchFile est très stable pour des fichiers simples.
fs.watchFile(LOCAL_FILE, { interval: 1000 }, async (curr, prev) => {
    // On évite de déclencher si le fichier a juste été accédé mais pas modifié
    if (curr.mtime <= prev.mtime) return;

    console.log(`\n📝 Changement détecté sur ${LOCAL_FILE}, envoi vers n8n...`);
    
    try {
        const fileContent = fs.readFileSync(LOCAL_FILE, 'utf8');
        let workflowData;

        try {
            workflowData = JSON.parse(fileContent);
        } catch (jsonError) {
            console.error('⚠️ JSON Invalide. Envoi annulé.');
            return;
        }

        // --- 🛡️ NETTOYAGE ULTRA-STRICT ---
        
        const cleanWorkflow = {
            name: workflowData.name,               // Le nom
            nodes: workflowData.nodes,             // La logique
            connections: workflowData.connections, // Les liens
            settings: workflowData.settings        // Les options (timezone, etc)
            
            // ❌ ON NE MET PLUS RIEN D'AUTRE
            // ni tags, ni active, ni id, ni meta, ni versionId
        };

        // Envoi à l'API
        await axios.put(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, 
            cleanWorkflow, 
            { headers: { 'X-N8N-API-KEY': API_KEY } }
        );
        
        console.log(`✅ Succès : Workflow #${WORKFLOW_ID} mis à jour dans n8n !`);
        
    } catch (error) {
        if (error.response) {
            console.error(`❌ Erreur API n8n (${error.response.status}):`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ Erreur Système :', error.message);
        }
    }
});