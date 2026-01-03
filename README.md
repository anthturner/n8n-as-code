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