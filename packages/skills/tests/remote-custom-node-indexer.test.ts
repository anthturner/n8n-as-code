import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RemoteCustomNodeIndexer } from '../src/services/remote-custom-node-indexer';

describe('RemoteCustomNodeIndexer', () => {
    let tempDir: string;
    let assetsDir: string;
    let workspaceRoot: string;
    let originalEnvHost: string | undefined;
    let originalEnvApiKey: string | undefined;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-remote-index-'));
        assetsDir = path.join(tempDir, 'assets');
        workspaceRoot = path.join(tempDir, 'workspace');
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.mkdirSync(path.join(workspaceRoot, '.vscode'), { recursive: true });

        originalEnvHost = process.env.N8N_HOST;
        originalEnvApiKey = process.env.N8N_API_KEY;
        delete process.env.N8N_HOST;
        delete process.env.N8N_API_KEY;
    });

    afterEach(() => {
        if (originalEnvHost !== undefined) {
            process.env.N8N_HOST = originalEnvHost;
        } else {
            delete process.env.N8N_HOST;
        }

        if (originalEnvApiKey !== undefined) {
            process.env.N8N_API_KEY = originalEnvApiKey;
        } else {
            delete process.env.N8N_API_KEY;
        }

        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('indexes only remote custom nodes and excludes curated base nodes', async () => {
        fs.writeFileSync(path.join(workspaceRoot, '.vscode', 'settings.json'), JSON.stringify({
            'n8n.host': 'http://localhost:5678/',
            'n8n.apiKey': 'test-key'
        }));

        const indexer = new RemoteCustomNodeIndexer(assetsDir, {
            workspaceRoot,
            createClient: () => ({
                getNodeTypes: async () => [
                    {
                        type: 'n8n-nodes-base.httpRequest',
                        name: 'httpRequest',
                        displayName: 'HTTP Request',
                        description: 'Base node',
                        properties: []
                    },
                    {
                        type: 'acme-nodes.customAnalytics',
                        name: 'customAnalytics',
                        displayName: 'Custom Analytics',
                        description: 'Custom node',
                        properties: []
                    }
                ]
            })
        });

        const result = await indexer.refresh({ force: true });
        expect(result.status).toBe('refreshed');
        expect(result.totalFetched).toBe(2);
        expect(result.totalCustom).toBe(1);

        const cache = indexer.loadCache();
        expect(cache).toBeDefined();
        expect(cache?.nodes['acme-nodes.customAnalytics']).toBeDefined();
        expect(cache?.nodes['n8n-nodes-base.httpRequest']).toBeUndefined();
    });

    it('returns cached status when existing cache is still fresh', async () => {
        fs.writeFileSync(path.join(workspaceRoot, '.vscode', 'settings.json'), JSON.stringify({
            'n8n.host': 'http://localhost:5678',
            'n8n.apiKey': 'test-key'
        }));

        let callCount = 0;
        const indexer = new RemoteCustomNodeIndexer(assetsDir, {
            workspaceRoot,
            defaultMaxAgeMs: 60_000,
            createClient: () => ({
                getNodeTypes: async () => {
                    callCount += 1;
                    return [
                        {
                            type: 'acme-nodes.customAnalytics',
                            name: 'customAnalytics',
                            displayName: 'Custom Analytics',
                            description: 'Custom node',
                            properties: []
                        }
                    ];
                }
            })
        });

        const first = await indexer.refresh({ force: true });
        expect(first.status).toBe('refreshed');

        const second = await indexer.refresh();
        expect(second.status).toBe('cached');
        expect(callCount).toBe(1);
    });

    it('throws when credentials are missing', async () => {
        const indexer = new RemoteCustomNodeIndexer(assetsDir, {
            workspaceRoot,
            createClient: () => ({
                getNodeTypes: async () => []
            })
        });

        await expect(indexer.refresh({ force: true })).rejects.toThrow('Missing n8n credentials');
    });
});
