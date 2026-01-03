require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const open = require('open'); // <--- NOUVEL IMPORT

// --- CONFIGURATION ---
const N8N_HOST = process.env.N8N_HOST;
const API_KEY = process.env.N8N_API_KEY;
const WATCH_DIR = './synced_workflows';

if (!N8N_HOST || !API_KEY) {
    console.error("❌ ERREUR: Variables manquantes dans le .env");
    process.exit(1);
}

if (!fs.existsSync(WATCH_DIR)) fs.mkdirSync(WATCH_DIR);

let workflowMap = new Map();

async function refreshWorkflowMap() {
    try {
        const response = await axios.get(`${N8N_HOST}/api/v1/workflows`, {
            headers: { 'X-N8N-API-KEY': API_KEY }
        });
        workflowMap.clear();
        response.data.data.forEach(wf => {
            workflowMap.set(wf.name, wf.id);
        });
        console.log(`📚 Annuaire mis à jour : ${workflowMap.size} workflows.`);
    } catch (error) {
        console.error("❌ Erreur API :", error.message);
    }
}

(async () => {
    await refreshWorkflowMap();
    console.log(`👀 Surveillance active : ${WATCH_DIR}`);

    let isProcessing = false;

    fs.watch(WATCH_DIR, async (eventType, filename) => {
        if (!filename || !filename.endsWith('.json') || isProcessing) return;

        const targetName = path.parse(filename).name;
        let targetId = workflowMap.get(targetName);

        if (!targetId) {
            await refreshWorkflowMap();
            targetId = workflowMap.get(targetName);
        }

        if (!targetId) return;

        const filePath = path.join(WATCH_DIR, filename);
        isProcessing = true;

        setTimeout(async () => {
            try {
                if (!fs.existsSync(filePath)) { isProcessing = false; return; }

                console.log(`\n⚡️ Modification : ${targetName} -> ID ${targetId}`);
                
                const fileContent = fs.readFileSync(filePath, 'utf8');
                let workflowData;
                try { workflowData = JSON.parse(fileContent); } catch (e) { isProcessing = false; return; }

                const cleanWorkflow = {
                    name: workflowData.name,
                    nodes: workflowData.nodes,
                    connections: workflowData.connections,
                    settings: workflowData.settings
                };

                await axios.put(`${N8N_HOST}/api/v1/workflows/${targetId}`, 
                    cleanWorkflow, 
                    { headers: { 'X-N8N-API-KEY': API_KEY } }
                );
                
                console.log(`✅ Workflow mis à jour !`);
                
                // --- 🪄 LA MAGIE OPÈRE ICI ---
                const targetUrl = `${N8N_HOST}/workflow/${targetId}`;
                console.log(`🖥️  Ouverture du navigateur : ${targetUrl}`);
                
                // Ouvre l'URL dans le navigateur par défaut
                await open(targetUrl);
                // -----------------------------

            } catch (error) {
                console.error(`❌ Erreur :`, error.message);
            } finally {
                isProcessing = false;
            }
        }, 500);
    });
})();