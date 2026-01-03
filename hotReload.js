// sync-n8n.js
const fs = require('fs');
const axios = require('axios');

// CONFIGURATION
const N8N_HOST = 'http://localhost:5678';
const API_KEY = 'VOTRE_API_KEY_N8N';
const WORKFLOW_ID = '15'; // L'ID du workflow à écraser
const LOCAL_FILE = './mon-workflow.json';

console.log(`📡 Surveillance du fichier : ${LOCAL_FILE}`);

fs.watchFile(LOCAL_FILE, async (curr, prev) => {
    console.log('📝 Changement détecté, envoi vers n8n...');
    
    try {
        const workflowData = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
        
        // L'API attend le JSON complet du workflow
        await axios.put(`${N8N_HOST}/api/v1/workflows/${WORKFLOW_ID}`, 
            workflowData, 
            { headers: { 'X-N8N-API-KEY': API_KEY } }
        );
        console.log('✅ Workflow mis à jour avec succès dans n8n !');
        
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour :', error.message);
    }
});