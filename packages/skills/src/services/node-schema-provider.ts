import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ESM and CJS (bundled)
const _filename = typeof __filename !== 'undefined'
    ? __filename
    : (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string' ? fileURLToPath(import.meta.url) : '');

const _dirname = typeof __dirname !== 'undefined'
    ? __dirname
    : (_filename ? path.dirname(_filename) : '');

export interface INodeSchemaStub {
    name: string;
    type: string;
    displayName: string;
    description: string;
    version: number | number[];
    keywords?: string[];
    operations?: string[];
    useCases?: string[];
    relevanceScore?: number;
}

export interface IEnrichedNode {
    name: string;
    type: string;
    displayName: string;
    description: string;
    version: number | number[];
    group?: string[];
    icon?: string;
    schema: {
        properties: any;
        sourcePath: string;
    };
    metadata: {
        keywords: string[];
        operations: string[];
        useCases: string[];
        keywordScore: number;
        hasDocumentation: boolean;
        markdownUrl: string | null;
        markdownFile: string | null;
    };
}

export interface INodeProviderOptions {
    includeRemoteCustomNodes?: boolean;
    remoteCustomNodesPath?: string;
}

interface IRemoteCustomNodesCache {
    nodes?: Record<string, any>;
}

export class NodeSchemaProvider {
    private index: any = null;
    private enrichedIndex: any = null;
    private enrichedIndexPath: string;
    private includeRemoteCustomNodes: boolean;
    private remoteCustomNodesPath: string;
    private remoteCustomNodes: Record<string, any> | null = null;

    constructor(customIndexPath?: string, options: INodeProviderOptions = {}) {
        const envAssetsDir = process.env.N8N_AS_CODE_ASSETS_DIR;
        if (customIndexPath) {
            this.enrichedIndexPath = customIndexPath;
        } else if (envAssetsDir && fs.existsSync(path.join(envAssetsDir, 'n8n-nodes-technical.json'))) {
            this.enrichedIndexPath = path.join(envAssetsDir, 'n8n-nodes-technical.json');
        } else {
            const siblingPath = path.resolve(_dirname, '../assets/n8n-nodes-technical.json');
            if (fs.existsSync(siblingPath)) {
                this.enrichedIndexPath = siblingPath;
            } else {
                this.enrichedIndexPath = path.resolve(_dirname, '../../assets/n8n-nodes-technical.json');
            }
        }

        this.includeRemoteCustomNodes = options.includeRemoteCustomNodes ?? true;
        const envRemotePath = process.env.N8N_AS_CODE_REMOTE_CUSTOM_NODES_PATH;
        this.remoteCustomNodesPath = options.remoteCustomNodesPath || envRemotePath || path.join(path.dirname(this.enrichedIndexPath), 'n8n-remote-custom-nodes.json');
    }


    private loadIndex() {
        if (this.index) return;

        // Load technical index (required)
        if (!fs.existsSync(this.enrichedIndexPath)) {
            throw new Error(
                `Technical node index not found at: ${this.enrichedIndexPath}\n` +
                `Please run the build process: npm run build in packages/skills`
            );
        }

        try {
            const content = fs.readFileSync(this.enrichedIndexPath, 'utf-8');
            this.enrichedIndex = JSON.parse(content);
            this.index = this.enrichedIndex;
        } catch (error: any) {
            throw new Error(
                `Failed to load technical node index: ${error.message}\n` +
                `The index file may be corrupted. Try rebuilding: npm run build in packages/skills`
            );
        }
    }

    private loadRemoteCustomNodes() {
        if (!this.includeRemoteCustomNodes) {
            this.remoteCustomNodes = {};
            return;
        }

        if (this.remoteCustomNodes !== null) {
            return;
        }

        if (!fs.existsSync(this.remoteCustomNodesPath)) {
            this.remoteCustomNodes = {};
            return;
        }

        try {
            const content = fs.readFileSync(this.remoteCustomNodesPath, 'utf-8');
            const parsed = JSON.parse(content) as IRemoteCustomNodesCache;
            this.remoteCustomNodes = parsed?.nodes && typeof parsed.nodes === 'object' ? parsed.nodes : {};
        } catch {
            this.remoteCustomNodes = {};
        }
    }

    private getMergedNodes(): Record<string, any> {
        this.loadIndex();
        this.loadRemoteCustomNodes();

        const merged: Record<string, any> = { ...this.index.nodes };
        const curatedEntries = Object.entries<any>(this.index.nodes);

        for (const remoteNode of Object.values<any>(this.remoteCustomNodes || {})) {
            const remoteType = (remoteNode?.type || '').toString().toLowerCase();
            const remoteName = (remoteNode?.name || remoteNode?.type || '').toString().toLowerCase();

            const overlapsCurated = curatedEntries.some(([curatedKey, curatedNode]) => {
                const curatedType = (curatedNode?.type || curatedNode?.name || curatedKey).toString().toLowerCase();
                const curatedName = (curatedNode?.name || curatedKey).toString().toLowerCase();

                return (remoteType && curatedType === remoteType) || (remoteName && curatedName === remoteName);
            });

            if (overlapsCurated) {
                continue;
            }

            const mergeKey = remoteNode?.name || remoteNode?.type;
            if (mergeKey && !merged[mergeKey]) {
                merged[mergeKey] = remoteNode;
            }
        }

        return merged;
    }

    /**
     * Get the full JSON schema for a specific node by name.
     * Returns null if not found.
     */
    public getNodeSchema(nodeName: string): any | null {
        this.loadIndex();
        this.loadRemoteCustomNodes();

        // Direct match
        if (this.index.nodes[nodeName]) {
            const node = this.index.nodes[nodeName];
            return {
                name: node.name,
                type: node.type,
                displayName: node.displayName,
                description: node.description,
                version: node.version,
                group: node.group,
                icon: node.icon,
                schema: node.schema,
                metadata: node.metadata
            };
        }

        // Case insensitive fallback
        const lowerName = nodeName.toLowerCase();
        const found = Object.keys(this.index.nodes).find(k => k.toLowerCase() === lowerName);

        if (found) {
            return this.index.nodes[found];
        }

        for (const [key, remoteNode] of Object.entries<any>(this.remoteCustomNodes || {})) {
            const remoteType = (remoteNode?.type || key).toString().toLowerCase();
            const remoteName = (remoteNode?.name || key).toString().toLowerCase();
            const remoteDisplayName = (remoteNode?.displayName || '').toString().toLowerCase();

            if (remoteType === lowerName || remoteName === lowerName || remoteDisplayName === lowerName) {
                return remoteNode;
            }
        }

        return null;
    }

    /**
     * Calculate relevance score for a node based on query
     */
    private calculateRelevance(query: string, node: any, key: string): number {
        const lowerQuery = query.toLowerCase();
        let score = 0;

        // Exact name match (highest priority)
        if (key.toLowerCase() === lowerQuery) {
            score += 1000;
        } else if (key.toLowerCase().includes(lowerQuery)) {
            score += 500;
        }

        // Display name match
        const displayName = (node.displayName || '').toLowerCase();
        if (displayName === lowerQuery) {
            score += 800;
        } else if (displayName.includes(lowerQuery)) {
            score += 400;
        }

        // Node type match
        const nodeType = (node.type || '').toLowerCase();
        if (nodeType === lowerQuery) {
            score += 900;
        } else if (nodeType.includes(lowerQuery)) {
            score += 250;
        }

        // Keyword match (from enriched metadata)
        if (node.metadata?.keywords) {
            const keywords = node.metadata.keywords;
            if (keywords.includes(lowerQuery)) {
                score += 300;
            }
            // Partial keyword match
            const matchingKeywords = keywords.filter((k: string) =>
                k.includes(lowerQuery) || lowerQuery.includes(k)
            );
            score += matchingKeywords.length * 50;
        }

        // Operations match
        if (node.metadata?.operations) {
            const matchingOps = node.metadata.operations.filter((op: string) =>
                op.toLowerCase().includes(lowerQuery)
            );
            score += matchingOps.length * 100;
        }

        // Use cases match
        if (node.metadata?.useCases) {
            const matchingUseCases = node.metadata.useCases.filter((uc: string) =>
                uc.toLowerCase().includes(lowerQuery)
            );
            score += matchingUseCases.length * 80;
        }

        // Description match (lower priority)
        const description = (node.description || '').toLowerCase();
        if (description.includes(lowerQuery)) {
            score += 100;
        }

        // Bonus for nodes with high keyword scores (AI/popular nodes)
        // Apply only when there is already at least one semantic match,
        // otherwise unrelated nodes can appear for arbitrary queries.
        if (score > 0 && node.metadata?.keywordScore) {
            score += node.metadata.keywordScore * 0.5;
        }

        // Multi-word query: check if all words match
        const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length > 1) {
            const allFields = [
                key.toLowerCase(),
                displayName,
                description,
                ...(node.metadata?.keywords || []),
                ...(node.metadata?.operations || []),
                ...(node.metadata?.useCases || [])
            ].join(' ');

            const matchedWords = queryWords.filter(word => allFields.includes(word));
            if (matchedWords.length === queryWords.length) {
                score += 200 * queryWords.length;
            }
        }

        return score;
    }

    /**
     * Fuzzy search for nodes with improved relevance scoring.
     * Returns a list of matches (stub only, not full schema).
     */
    public searchNodes(query: string, limit: number = 20): INodeSchemaStub[] {
        const nodes = this.getMergedNodes();
        const lowerQuery = query.toLowerCase();
        const scoredResults: Array<INodeSchemaStub & { score: number }> = [];

        for (const [key, node] of Object.entries<any>(nodes)) {
            const score = this.calculateRelevance(query, node, key);

            if (score > 0) {
                scoredResults.push({
                    name: node.name || key,
                    type: node.type || node.name || key,
                    displayName: node.displayName || key,
                    description: node.description || '',
                    version: node.version,
                    keywords: node.metadata?.keywords || [],
                    operations: node.metadata?.operations || [],
                    useCases: node.metadata?.useCases || [],
                    relevanceScore: score,
                    score
                });
            }
        }

        // Sort by score (highest first) and take top results
        scoredResults.sort((a, b) => b.score - a.score);

        return scoredResults.slice(0, limit).map(({ score, ...rest }) => rest);
    }

    /**
     * List all available nodes (compact format).
     */
    public listAllNodes(): INodeSchemaStub[] {
        const nodes = this.getMergedNodes();
        return Object.values<any>(nodes).map(node => ({
            name: node.name,
            type: node.type || node.name,
            displayName: node.displayName,
            description: node.description || '',
            version: node.version,
            keywords: node.metadata?.keywords || [],
            operations: node.metadata?.operations || [],
            useCases: node.metadata?.useCases || []
        }));
    }
}
