import axios, { AxiosInstance } from 'axios';
import { ConfigurationService } from '../config/configuration';
import { IWorkflow, IWorkflowListResponse } from '../models/workflow';

export class N8nApiClient {
    private config: ConfigurationService;
    
    constructor() {
        this.config = ConfigurationService.getInstance();
    }

    private get client(): AxiosInstance {
        return axios.create({
            baseURL: this.config.baseUrl,
            headers: {
                'X-N8N-API-KEY': this.config.apiKey
            },
            timeout: 5000
        });
    }

    /**
     * Récupère la liste des workflows depuis n8n
     */
    public async getWorkflows(): Promise<IWorkflow[]> {
        if (!this.config.isValid()) {
            throw new Error("Configuration invalide : API Key manquante");
        }

        try {
            // Note: Endpoint standard n8n v1
            const response = await this.client.get<IWorkflowListResponse>('/api/v1/workflows');
            return response.data.data;
        } catch (error: any) {
            console.error('Erreur API n8n:', error);
            // Si pas d'accès, on renvoie une liste vide ou on propage l'erreur
            // Pour le débug, on peut renvoyer des fausses données si l'API échoue
            throw new Error(error.response?.data?.message || error.message);
        }
    }
}