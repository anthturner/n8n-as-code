import * as vscode from 'vscode';
import { N8nApiClient } from '../services/n8nApiClient';
import { IWorkflow } from '../models/workflow';

export class WorkflowTreeProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeItem | undefined | null | void> = new vscode.EventEmitter<WorkflowTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorkflowTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private apiClient: N8nApiClient;

    constructor() {
        this.apiClient = new N8nApiClient();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
        if (element) {
            // Si on a des dossiers ou des sous-éléments, on gérerait ici
            return [];
        } else {
            // Racine : On charge les workflows
            return this.fetchWorkflows();
        }
    }

    private async fetchWorkflows(): Promise<WorkflowTreeItem[]> {
        try {
            const workflows = await this.apiClient.getWorkflows();
            
            return workflows.map(wf => new WorkflowTreeItem(
                wf.name,
                wf.active ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None,
                wf.active,
                wf.id
            ));
        } catch (error) {
            vscode.window.showErrorMessage(`Erreur récupération n8n: ${error}`);
            // Retourne un item d'erreur
            return [new WorkflowTreeItem("⚠️ Erreur de connexion", vscode.TreeItemCollapsibleState.None, false, "error")];
        }
    }
}

export class WorkflowTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isActive: boolean,
        public readonly id: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = `${this.label} (ID: ${this.id})`;
        this.description = this.isActive ? 'Active' : 'Inactive';
        
        // Icône selon le statut
        this.iconPath = new vscode.ThemeIcon(this.isActive ? 'play-circle' : 'stop-circle');
    }
}