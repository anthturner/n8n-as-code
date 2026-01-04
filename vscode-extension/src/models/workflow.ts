/**
 * Représente un workflow simplifié pour l'affichage dans la liste
 */
export interface IWorkflow {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    tags: string[];
}

/**
 * Structure de réponse typique de l'API n8n
 */
export interface IWorkflowListResponse {
    data: IWorkflow[];
    nextCursor?: string;
}