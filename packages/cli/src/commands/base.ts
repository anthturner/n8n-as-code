import { N8nApiClient, IN8nCredentials } from '@n8n-as-code/core';
import chalk from 'chalk';
import { ConfigService } from '../services/config-service.js';

export class BaseCommand {
    protected client: N8nApiClient;
    protected config: any;

    constructor() {
        const configService = new ConfigService();
        const localConfig = configService.getLocalConfig();
        const apiKey = localConfig.host ? configService.getApiKey(localConfig.host) : undefined;

        if (!localConfig.host || !apiKey) {
            console.error(chalk.red('❌ CLI not configured.'));
            console.error(chalk.yellow('Please run `n8n-as-code init` to set up your environment.'));
            process.exit(1);
        }

        const credentials: IN8nCredentials = {
            host: localConfig.host,
            apiKey: apiKey
        };

        this.client = new N8nApiClient(credentials);

        // Basic config defaults from local config
        this.config = {
            directory: localConfig.syncFolder || './workflows',
            pollInterval: localConfig.pollInterval || 3000,
            syncInactive: localConfig.syncInactive ?? true,
            ignoredTags: localConfig.ignoredTags || ['archive']
        };
    }
}
