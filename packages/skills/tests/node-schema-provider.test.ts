import { NodeSchemaProvider } from '../src/services/node-schema-provider';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('NodeSchemaProvider', () => {
    let tempDir: string;
    let indexPath: string;
    let remotePath: string;
    let provider: NodeSchemaProvider;

    const mockIndex = {
        nodes: {
            slack: {
                name: 'slack',
                displayName: 'Slack',
                description: 'Send Slack messages',
                version: 1,
                properties: []
            },
            postgres: {
                name: 'postgres',
                displayName: 'PostgreSQL',
                description: 'Run SQL queries',
                version: [1, 2],
                properties: []
            }
        }
    };

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-test-'));
        indexPath = path.join(tempDir, 'n8n-nodes-enriched.json');
        remotePath = path.join(tempDir, 'n8n-remote-custom-nodes.json');
        fs.writeFileSync(indexPath, JSON.stringify(mockIndex));
        fs.writeFileSync(remotePath, JSON.stringify({
            version: '1.0.0',
            generatedAt: '2026-01-01T00:00:00.000Z',
            sourceHost: 'http://localhost:5678',
            totalFetched: 2,
            totalCustom: 1,
            nodes: {
                'acme-nodes.customAnalytics': {
                    name: 'customAnalytics',
                    displayName: 'Custom Analytics',
                    type: 'acme-nodes.customAnalytics',
                    version: 1,
                    description: 'Run custom analytics operations',
                    schema: { properties: [] },
                    metadata: {
                        keywords: ['custom', 'analytics'],
                        operations: [],
                        useCases: [],
                        keywordScore: 20,
                        source: 'remote-custom'
                    }
                }
            }
        }));
        provider = new NodeSchemaProvider(indexPath, { remoteCustomNodesPath: remotePath });
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('should get a specific node schema', () => {
        const schema = provider.getNodeSchema('slack');
        expect(schema).toBeDefined();
        expect(schema.displayName).toBe('Slack');
    });

    test('should get node schema case-insensitively', () => {
        const schema = provider.getNodeSchema('SLACK');
        expect(schema).toBeDefined();
        expect(schema.name).toBe('slack');
    });

    test('should return null for unknown node', () => {
        const schema = provider.getNodeSchema('unknownNode');
        expect(schema).toBeNull();
    });

    test('should search for nodes by query', () => {
        const results = provider.searchNodes('sql');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('postgres');
    });

    test('should search case-insensitively', () => {
        const results = provider.searchNodes('SLACK');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('slack');
    });

    test('should list all nodes', () => {
        const list = provider.listAllNodes();
        expect(list).toHaveLength(3);
        expect(list.some(n => n.name === 'slack')).toBe(true);
        expect(list.some(n => n.name === 'postgres')).toBe(true);
        expect(list.some(n => n.name === 'customAnalytics')).toBe(true);
    });

    test('should search and resolve remote custom nodes', () => {
        const results = provider.searchNodes('custom analytics');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].type).toBe('acme-nodes.customAnalytics');

        const schema = provider.getNodeSchema('acme-nodes.customAnalytics');
        expect(schema).toBeDefined();
        expect(schema?.name).toBe('customAnalytics');
    });

    test('should keep curated metadata precedence when names overlap', () => {
        fs.writeFileSync(remotePath, JSON.stringify({
            version: '1.0.0',
            generatedAt: '2026-01-01T00:00:00.000Z',
            sourceHost: 'http://localhost:5678',
            totalFetched: 1,
            totalCustom: 1,
            nodes: {
                slack: {
                    name: 'slack',
                    displayName: 'Slack Remote',
                    type: 'acme-nodes.slack',
                    version: 1,
                    description: 'Remote slack clone',
                    schema: { properties: [] },
                    metadata: { keywords: ['remote'] }
                }
            }
        }));

        const scopedProvider = new NodeSchemaProvider(indexPath, { remoteCustomNodesPath: remotePath });
        const schema = scopedProvider.getNodeSchema('slack');
        expect(schema).toBeDefined();
        expect(schema?.displayName).toBe('Slack');
    });
});
