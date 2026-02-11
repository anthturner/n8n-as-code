---
sidebar_position: 3
title: Skills CLI (Tools for AI agents)
description: Use the Skills CLI to search n8n nodes, get JSON schemas, and list available nodes for AI coding assistants.
---

# Skills CLI (Tools for AI agents)

The Skills CLI (`@n8n-as-code/skills`) provides command-line tools specifically designed for AI coding assistants and developers working with n8n workflows. It allows you to search, retrieve, and list n8n node schemas programmatically.

## 🎯 Purpose

The Skills CLI is designed to:
- **Provide structured data** about n8n nodes for AI coding assistants
- **Enable search capabilities** for finding specific nodes by name or description
- **Generate JSON schemas** that can be used for code completion and validation
- **Support AI context generation** for better workflow suggestions
- **Access community workflows** - Search and download from 7000+ real-world workflows

## 📦 Installation

The Skills CLI is available as an npm package and can be run directly with npx:

```bash
# Run with n8nac-skills (if installed globally)
n8nac-skills <command>

# Or run directly with npx
npx @n8n-as-code/skills <command>

# Or install globally
npm install -g @n8n-as-code/skills
```

## 🛠️ Available Commands

### 1. Search Nodes
# Skills (AI Tools)

The Skills package (`@n8n-as-code/skills`) provides command-line tools specifically designed for AI coding assistants and developers working with n8n workflows. It allows you to search, retrieve, and list n8n node schemas programmatically.

## 🛠 Purpose

This package provides a dedicated CLI (`n8nac-skills`) and programmatic tools designed to:

## 🚀 Installation

```bash
npm install @n8n-as-code/skills
```

## 📖 CLI Usage

### `search <query>` - 🚀 Deep Unified Search (PRIMARY TOOL)

```bash
# Search nodes, docs, and tutorials
n8nac-skills search "how to generate images"
n8nac-skills search "google sheets"

# Filter by type
n8nac-skills search "authentication" --type documentation
n8nac-skills search "database" --type node

# Filter by category
n8nac-skills search "ai" --category advanced-ai
```

### `get <nodeName>` - 📚 Complete Node Info
Get full node information: schema + documentation + examples.

```bash
n8nac-skills get googleSheets
n8nac-skills get httpRequest
```

### `schema <nodeName>` - ⚡ Quick Parameter Reference

```bash
n8nac-skills schema googleSheets
# Returns only properties and required fields
```

### `docs <title>` - 📖 Read Documentation

```bash
# Read a specific page
n8nac-skills docs "Google Gemini"
n8nac-skills docs "Expressions"

# List categories or stats
n8nac-skills docs --list
```

### `guides [query]` - 🎯 Find Guides

```bash
n8nac-skills guides "email automation"
n8nac-skills guides "ai workflow"
n8nac-skills guides --list
```

### `workflows` - 🌐 Search & Download Community Workflows

```bash
n8nac-skills workflows search "slack notification"
n8nac-skills workflows search "AI chatbot telegram"
n8nac-skills workflows search "invoice processing" --limit 20
n8nac-skills workflows search "google sheets" --json

n8nac-skills workflows info 916
n8nac-skills workflows install 916
n8nac-skills workflows install 4365 --output my-chatbot.json
n8nac-skills workflows install 8088 --force

n8nac-skills workflows list
n8nac-skills workflows list --limit 50
```

### `related <query>` - 🔗 Discover Resources

```bash
n8nac-skills related googleSheets
# Returns: Google Drive, Excel, Airtable, related docs

n8nac-skills related "ai agents"
# Returns: AI-related concepts, nodes, examples
```

### `list` - 📋 List Resources

```bash
# Summary of nodes and docs
n8nac-skills list

# List all node names
n8nac-skills list --nodes

# List all doc categories
n8nac-skills list --docs
```

### `validate <file>` - ✅ Validate Workflows

```bash
n8nac-skills validate workflow.json
n8nac-skills validate workflow.json --strict
```

### `update-ai` - 🤖 Update AI Context
Update AI Context (AGENTS.md, rule files, snippets).

```bash
n8nac-skills update-ai
n8nac-skills update-ai --version 1.70.0
```

### `index-remote-nodes` - 🧩 Index Custom Nodes From Your n8n Instance

Refresh and cache custom nodes from your configured n8n instance API (`/rest/node-types`).

```bash
# Standard refresh (uses freshness window)
n8nac-skills index-remote-nodes

# Force refresh now
n8nac-skills index-remote-nodes --force

# Clear cache then refresh
n8nac-skills index-remote-nodes --clear-cache --force
```

Notes:
- Only **custom** nodes are cached from remote.
- Curated node metadata remains authoritative and is never overwritten.
- Normal commands (`search`, `get`, `schema`, `list`) automatically use the cache when present.

Credential resolution follows extension behavior:
1. `.vscode/settings.json` (`n8n.host`, `n8n.apiKey`)
2. Environment fallback (`N8N_HOST`, `N8N_API_KEY`)

## 📊 Output Format

All commands output JSON for easy parsing by scripts and AI tools:

### Search Output Example
```json
[
  {
    "name": "httpRequest",
    "displayName": "HTTP Request",
    "description": "Makes an HTTP request to a specified URL",
    "category": "Sync"
  },
  {
    "name": "httpBin",
    "displayName": "HTTP Bin",
    "description": "Test HTTP requests",
    "category": "Sync"
  }
]
```

### Get Schema Output Example
```json
{
  "name": "httpRequest",
  "displayName": "HTTP Request",
  "description": "Makes an HTTP request to a specified URL",
  "properties": [
    {
      "name": "url",
      "type": "string",
      "required": true,
      "description": "The URL to make the request to"
    },
    {
      "name": "method",
      "type": "string",
      "required": true,
      "default": "GET",
      "description": "HTTP method to use"
    }
  ]
}
```

## 🔧 Integration with AI Assistants

The Skills CLI is designed to be used by AI coding assistants to:
1. **Understand n8n node structure** - Get detailed schemas for accurate code generation
2. **Provide context-aware suggestions** - Search for relevant nodes based on user intent
3. **Validate workflow JSON** - Use schemas to validate generated workflow structures

### Example AI Integration Workflow

```bash
# AI Assistant workflow for generating n8n workflow code
1. User asks: "Create a workflow that reads from Google Sheets"
2. AI runs: npx @n8n-as-code/skills search "google sheets"
3. AI gets node schemas: npx @n8n-as-code/skills get googleSheets
4. AI generates accurate JSON with proper parameters
```

## 📁 Data Source

The Skills CLI uses a pre-generated index of n8n nodes from the official n8n source code. The data is stored in `dist/assets/` (generated during build):

- `n8n-knowledge-index.json`: Unified FlexSearch index for the `search` command.
- `n8n-nodes-technical.json`: Detailed technical schemas for the `get` command.
- `n8n-docs-complete.json`: Full documentation content.
- `n8n-remote-custom-nodes.json`: Cached remote custom-node index generated by `index-remote-nodes`.

This includes:
- All sync n8n nodes
- Community nodes (when available)
- Node properties and parameters
- Type definitions and validation rules

## 🔄 Related Tools

### AI Context Generation
The main CLI (`@n8n-as-code/cli`) includes an `update-ai` command (with `init-ai` kept as an alias) that generates comprehensive context files for AI assistants:

```bash
n8nac update-ai
```

This command creates:
- `.vscode/n8n.code-snippets` - Code snippets generated from n8n-nodes-index.json
- `n8n-nodes-index.json` - Index of all available nodes
- Documentation files for AI context

### VS Code Extension
For visual editing and real-time sync, use the [VS Code Extension](/docs/usage/vscode-extension).

### Main CLI
For workflow management and automation, use the [Main CLI](/docs/usage/cli).

## 🚀 Quick Start

1. **Search for nodes you need:**
   ```bash
   npx @n8n-as-code/skills search "your query"
   ```

2. **Get detailed schema for a specific node:**
   ```bash
   npx @n8n-as-code/skills get nodeName
   ```

3. **List all available nodes:**
   ```bash
   npx @n8n-as-code/skills list
   ```

## 📖 Next Steps

- Learn about the [Main CLI](/docs/usage/cli) for workflow management
- Explore the [VS Code Extension](/docs/usage/vscode-extension) for visual editing
- Check the [Contribution Guide](/docs/contribution) for development details

## 🆘 Troubleshooting

**Command not found:**
```bash
# Make sure you're using the correct package name
npx @n8n-as-code/skills --help
```

**Node not found:**
```bash
# Check available nodes first
npx @n8n-as-code/skills list | grep "your-node"
```

**JSON parsing issues:**
```bash
# Pipe output to jq for pretty printing
npx @n8n-as-code/skills search "http" | jq .
```

**Remote custom nodes are missing:**
```bash
# Refresh cache explicitly
npx @n8n-as-code/skills index-remote-nodes --force
```

Check that your workspace `.vscode/settings.json` contains `n8n.host` and `n8n.apiKey`, or set `N8N_HOST` and `N8N_API_KEY`.

**Cannot fetch `/rest/node-types`:**
- Verify your n8n URL and API key
- Confirm the n8n instance is reachable
- Confirm your n8n version/permissions allow node-types retrieval

For more help, check the [Troubleshooting guide](/docs/troubleshooting) or [open an issue](https://github.com/EtienneLescot/n8n-as-code/issues).
