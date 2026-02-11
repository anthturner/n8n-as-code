import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface IN8nCredentials {
    host: string;
    apiKey: string;
}

export interface IRemoteCustomNode {
    name: string;
    type: string;
    displayName: string;
    description: string;
    version: number | number[];
    group?: string[];
    icon?: string;
    schema: {
        properties: any[];
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
        source: 'remote-custom';
        fetchedFrom: string;
        fetchedAt: string;
    };
}

export interface IRemoteCustomNodesCache {
    version: string;
    generatedAt: string;
    sourceHost: string;
    totalFetched: number;
    totalCustom: number;
    nodes: Record<string, IRemoteCustomNode>;
}

export interface IRemoteCustomNodesRefreshOptions {
    force?: boolean;
    maxAgeMs?: number;
    clearCacheBeforeRefresh?: boolean;
}

export interface IRemoteCustomNodesRefreshResult {
    status: 'refreshed' | 'cached';
    cachePath: string;
    sourceHost: string;
    generatedAt: string;
    totalFetched: number;
    totalCustom: number;
}

interface INodeTypesClient {
    getNodeTypes(): Promise<unknown>;
}

interface IRemoteCustomNodeIndexerDeps {
    workspaceRoot?: string;
    defaultMaxAgeMs?: number;
    createClient?: (credentials: IN8nCredentials) => INodeTypesClient;
}

export class RemoteCustomNodeIndexer {
    private readonly workspaceRoot: string;
    private readonly cachePath: string;
    private readonly defaultMaxAgeMs: number;
    private readonly createClient: (credentials: IN8nCredentials) => INodeTypesClient;

    constructor(assetsDir: string, deps: IRemoteCustomNodeIndexerDeps = {}) {
        this.workspaceRoot = deps.workspaceRoot || process.cwd();
        this.cachePath = path.join(assetsDir, 'n8n-remote-custom-nodes.json');
        this.defaultMaxAgeMs = deps.defaultMaxAgeMs ?? 5 * 60 * 1000;
        this.createClient = deps.createClient || ((credentials: IN8nCredentials) => {
            const syncModule = require('@n8n-as-code/sync');
            return new syncModule.N8nApiClient(credentials);
        });
    }

    public getCachePath(): string {
        return this.cachePath;
    }

    public loadCache(): IRemoteCustomNodesCache | null {
        if (!fs.existsSync(this.cachePath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(this.cachePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object' || typeof parsed.nodes !== 'object') {
                return null;
            }
            return parsed as IRemoteCustomNodesCache;
        } catch {
            return null;
        }
    }

    public clearCache(): void {
        if (fs.existsSync(this.cachePath)) {
            fs.unlinkSync(this.cachePath);
        }
    }

    public async refresh(options: IRemoteCustomNodesRefreshOptions = {}): Promise<IRemoteCustomNodesRefreshResult> {
        if (options.clearCacheBeforeRefresh) {
            this.clearCache();
        }

        const credentials = this.resolveCredentials();
        const sourceHost = this.normalizeHost(credentials.host);
        const maxAgeMs = options.maxAgeMs ?? this.defaultMaxAgeMs;

        const existing = this.loadCache();
        if (!options.force && existing && existing.sourceHost === sourceHost) {
            const ageMs = Date.now() - Date.parse(existing.generatedAt);
            if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs) {
                return {
                    status: 'cached',
                    cachePath: this.cachePath,
                    sourceHost,
                    generatedAt: existing.generatedAt,
                    totalFetched: existing.totalFetched,
                    totalCustom: existing.totalCustom
                };
            }
        }

        const client = this.createClient(credentials);
        const response = await client.getNodeTypes();
        const entries = this.extractNodeTypeEntries(response);

        if (entries.length === 0) {
            throw new Error('No node types were returned by the n8n API (/rest/node-types).');
        }

        const fetchedAt = new Date().toISOString();
        const nodes: Record<string, IRemoteCustomNode> = {};

        for (const entry of entries) {
            const mapped = this.mapNodeType(entry, sourceHost, fetchedAt);
            if (!mapped) continue;
            if (!this.isCustomNodeType(mapped.type)) continue;
            nodes[mapped.type] = mapped;
        }

        const cache: IRemoteCustomNodesCache = {
            version: '1.0.0',
            generatedAt: fetchedAt,
            sourceHost,
            totalFetched: entries.length,
            totalCustom: Object.keys(nodes).length,
            nodes
        };

        fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
        fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), 'utf-8');

        return {
            status: 'refreshed',
            cachePath: this.cachePath,
            sourceHost,
            generatedAt: cache.generatedAt,
            totalFetched: cache.totalFetched,
            totalCustom: cache.totalCustom
        };
    }

    private resolveCredentials(): IN8nCredentials {
        const fromSettings = this.readExtensionSettings();

        const host = this.normalizeHost(fromSettings.host || '');
        const apiKey = (fromSettings.apiKey || '').trim();

        if (!host || !apiKey) {
            throw new Error(
                'Missing n8n credentials. Configure "n8n.host" and "n8n.apiKey" in extension settings.'
            );
        }

        return { host, apiKey };
    }

    private readExtensionSettings(): { host?: string; apiKey?: string } {
        const settingsPath = path.join(this.workspaceRoot, '.vscode', 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            return {};
        }

        try {
            const raw = fs.readFileSync(settingsPath, 'utf-8');
            return {
                host: this.extractSetting(raw, 'n8n.host'),
                apiKey: this.extractSetting(raw, 'n8n.apiKey')
            };
        } catch {
            return {};
        }
    }

    private extractSetting(raw: string, key: string): string | undefined {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`"${escaped}"\\s*:\\s*"([^"]*)"`, 'i');
        const match = raw.match(regex);
        return match && match[1] ? match[1].trim() : undefined;
    }

    private normalizeHost(host: string): string {
        return host.trim().replace(/\/+$/, '');
    }

    private extractNodeTypeEntries(response: unknown): Array<Record<string, unknown>> {
        if (Array.isArray(response)) {
            return response.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
        }

        if (!response || typeof response !== 'object') {
            return [];
        }

        const record = response as Record<string, unknown>;

        if (Array.isArray(record.data)) {
            return record.data.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
        }

        if (record.data && typeof record.data === 'object') {
            return Object.entries(record.data as Record<string, unknown>)
                .filter(([, value]) => !!value && typeof value === 'object')
                .map(([key, value]) => ({
                    __typeKey: key,
                    ...(value as Record<string, unknown>)
                }));
        }

        if (record.nodeTypes && typeof record.nodeTypes === 'object') {
            return Object.entries(record.nodeTypes as Record<string, unknown>)
                .filter(([, value]) => !!value && typeof value === 'object')
                .map(([key, value]) => ({
                    __typeKey: key,
                    ...(value as Record<string, unknown>)
                }));
        }

        return Object.entries(record)
            .filter(([, value]) => !!value && typeof value === 'object')
            .map(([key, value]) => ({
                __typeKey: key,
                ...(value as Record<string, unknown>)
            }));
    }

    private mapNodeType(rawNode: Record<string, unknown>, sourceHost: string, fetchedAt: string): IRemoteCustomNode | null {
        const defaults = this.toRecord(rawNode.defaults);

        const type = this.asString(rawNode.type) || this.asString(rawNode.__typeKey) || this.asString(rawNode.name) || this.asString(defaults?.name);
        if (!type) {
            return null;
        }

        const normalizedType = type.trim();
        const shortName = this.asString(rawNode.name) || normalizedType.split('.').pop() || normalizedType;
        const displayName = this.asString(rawNode.displayName) || this.asString(defaults?.name) || shortName;
        const description = this.asString(rawNode.description) || '';
        const group = this.toStringArray(rawNode.group);
        const icon = this.asString(rawNode.icon) || this.asString(defaults?.icon);
        const version = this.parseVersion(rawNode.version);
        const properties = Array.isArray(rawNode.properties) ? rawNode.properties : [];
        const keywords = this.buildKeywords(shortName, displayName, description, normalizedType);

        return {
            name: shortName,
            type: normalizedType,
            displayName,
            description,
            version,
            group: group.length > 0 ? group : ['custom'],
            icon,
            schema: {
                properties,
                sourcePath: `remote:${sourceHost}`
            },
            metadata: {
                keywords,
                operations: [],
                useCases: [],
                keywordScore: Math.min(100, keywords.length * 5 + (description ? 10 : 0)),
                hasDocumentation: false,
                markdownUrl: null,
                markdownFile: null,
                source: 'remote-custom',
                fetchedFrom: sourceHost,
                fetchedAt
            }
        };
    }

    private isCustomNodeType(type: string): boolean {
        const normalizedType = type.toLowerCase();
        const curatedPrefixes = [
            'n8n-nodes-base.',
            '@n8n/n8n-nodes-base.',
            'n8n-nodes-langchain.',
            '@n8n/n8n-nodes-langchain.'
        ];

        return !curatedPrefixes.some(prefix => normalizedType.startsWith(prefix));
    }

    private toRecord(value: unknown): Record<string, unknown> | null {
        if (!value || typeof value !== 'object') return null;
        return value as Record<string, unknown>;
    }

    private asString(value: unknown): string | undefined {
        if (typeof value === 'string') return value;
        return undefined;
    }

    private toStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value.filter((v): v is string => typeof v === 'string');
    }

    private parseVersion(value: unknown): number | number[] {
        if (typeof value === 'number') return value;
        if (Array.isArray(value)) {
            const versions = value.filter((v): v is number => typeof v === 'number');
            if (versions.length > 0) return versions;
        }
        return 1;
    }

    private buildKeywords(...fields: string[]): string[] {
        const bag = new Set<string>();

        for (const field of fields) {
            const normalized = field.toLowerCase();
            normalized.split(/[^a-z0-9]+/g).forEach(token => {
                if (token.length > 2) {
                    bag.add(token);
                }
            });
        }

        return Array.from(bag).slice(0, 40);
    }
}
