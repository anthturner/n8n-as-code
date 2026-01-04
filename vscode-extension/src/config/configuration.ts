import * as vscode from 'vscode';

export class ConfigurationService {
    private static instance: ConfigurationService;

    private constructor() {}

    public static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    /**
     * Récupère l'URL de base de l'instance n8n
     */
    public get baseUrl(): string {
        let url = vscode.workspace.getConfiguration('n8n').get<string>('host') || 'http://localhost:5678';
        // Retire le slash final si présent
        return url.replace(/\/$/, '');
    }

    /**
     * Récupère la clé API
     */
    public get apiKey(): string {
        return vscode.workspace.getConfiguration('n8n').get<string>('apiKey') || '';
    }

    /**
     * Vérifie si la configuration minimale est présente
     */
    public isValid(): boolean {
        return this.apiKey !== '' && this.baseUrl !== '';
    }
}