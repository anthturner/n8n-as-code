# n8n-as-code 🚀

> **Stop clicking. Start coding.**

**n8n-as-code** is a bidirectional synchronization tool between n8n and your local file system. It transforms your n8n workflows into clean, editable, and versionable JSON files.

The **main goal**? Enable AI Agents (Cursor, Copilot, Windsurf) to generate and modify your n8n workflows directly from your code editor, bypassing the graphical interface.

## ✨ Why use this tool?

* **AI-First Workflow:** Ask your AI "Create a workflow that scrapes Google News" inside VS Code, and watch it appear instantly in n8n.
* **GitOps Ready:** Finally version your workflows properly. The script sanitizes unnecessary metadata (dynamic IDs, execution stats) so `git diff` shows only the actual logic.
* **Bidirectional Sync:**
    * Modify in VS Code ➔ Immediate update in n8n.
    * Modify in n8n ➔ Immediate update of the local file.

---

## 🛠 Installation

### Prerequisites
* Node.js (v16+)
* An active n8n instance (local or cloud)

### Setup

1.  **Clone this repository:**
    ```bash
    git clone [https://github.com/EtienneLescot/n8n-as-code.git](https://github.com/EtienneLescot/n8n-as-code.git)
    cd n8n-as-code
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure your environment:**
    Create a `.env` file at the root:

    ```properties
    N8N_HOST=http://localhost:5678
    # Get your API key in n8n > Settings > Developer API
    N8N_API_KEY=your_api_key_here
    ```

---

## 🚀 Usage

Simply run the sync script:

```bash
node sync.js
```

---

## 📁 Managing `synced_workflows` Directory

The `synced_workflows` directory is excluded from the main repository via `.gitignore`. This allows you to manage your workflows independently. The repository is automatically initialized when you run `npm install` thanks to the `postinstall` script.

### Optional: Connect to a Remote Repository

If you want to sync your workflows to a remote repository, follow these steps:

1. Navigate to the `synced_workflows` directory:
   ```bash
   cd synced_workflows
   ```

2. Connect to your remote repository:
   ```bash
   git remote add origin <your-remote-repo-url>
   git push -u origin main
   ```

Now, your workflows are versioned independently of the main repository.