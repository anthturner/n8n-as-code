<p align="center">
  <img src="assets/logo.png" alt="n8n-as-code logo" width="120" />
</p>

# 🚀 n8n-as-code

**n8n-as-code** est un écosystème conçu pour gérer vos workflows n8n comme du code. Il transforme vos automations en fichiers JSON locaux synchronisés, permettant le versioning (Git), l'édition assistée par IA et une intégration fluide dans VS Code.

---

## ⚡ Quick Start

Prêt à synchroniser vos workflows en moins de 2 minutes ?

1.  **Installation** :
    ```bash
    npm install && npm run build
    npm link
    ```

    > **Note** : La commande `npm link` permet de créer un lien global vers le CLI, vous permettant d'utiliser `n8n-as-code` directement depuis n'importe quel terminal.
2.  **Configuration** :
    ```bash
    n8n-as-code init
    ```
    > **Note** : L'assistant vous guidera pour configurer votre instance n8n et stockera votre clé d'API de manière sécurisée hors de votre projet.
3.  **Sync initial** : Téléchargez vos workflows existants :
    ```bash
    n8n-as-code pull
    ```
4.  **Ouvrez VS Code** : Installez l'extension locale (`packages/vscode-extension`) et profitez de la synchronisation automatique et de l'assistance IA.

---

## 🎨 VS Code Extension : Le cockpit n8n

L'extension transforme VS Code en un véritable IDE pour n8n.

-   **Activity Bar Icon** : Un accès direct à tous vos workflows depuis le panneau latéral de gauche.
-   **Embedded Board** : Ouvrez vos workflows dans une vue web intégrée pour un retour visuel immédiat.
-   **Split View** : Éditez le JSON à gauche tout en gardant le canvas n8n à droite.
-   **Push on Save** : Toute modification locale est instantanément envoyée vers n8n.
-   **Automatic AI Context** : Dès l'ouverture, l'extension génère automatiquement l'assistance IA (`AGENTS.md`, snippets, schémas).

---

## ⚙️ Configuration

Le CLI utilise un système de configuration interactif et sécurisé via la commande `init`.

### Fichiers de configuration
- **`n8n-as-code.json`** : Contient les réglages du projet (Host, dossiers, etc.). Ce fichier est créé à la racine et peut être partagé via Git.
- **Stockage Global** : Vos clés d'API sont liées à l'hôte et stockées localement sur votre machine par le système, jamais commitées.

---

## 🛠 CLI Commands (`@n8n-as-code/cli`)

Pour ceux qui préfèrent le terminal ou l'automatisation. Les commandes sont accessibles via `n8n-as-code`.

-   **`init`** : Configure votre instance n8n et votre projet local.
-   **`pull`** : Récupère tous les workflows depuis n8n.
-   **`push`** : Envoie les nouveaux fichiers locaux vers n8n.
-   **`watch`** : Mode synchronisation bidirectionnelle en temps réel.
-   **`init-ai`** : Génère le contexte pour votre agent IA.

Exemple d'utilisation :
```bash
n8n-as-code init
n8n-as-code pull
n8n-as-code watch
```

---

## 🤖 AI Context & Super-pouvoirs

Nous injectons du contexte spécifique pour rendre votre IA (Cursor, Windsurf, Copilot) experte en n8n :

-   📄 **`AGENTS.md`** : Instructions système sur la structure n8n et les bonnes pratiques.
-   🛡️ **`n8n-schema.json`** : Validation stricte de vos JSON pour éviter les erreurs de structure.
-   🧩 **Snippets** : Bibliothèque de nœuds prédéfinis (Webhook, Code, HTTP...) pour coder plus vite.

---

## 🛠️ Développement et Tests Locaux

Mode Debug (F5) depuis packages\vscode-extension

ou

Utilisez la commande suivante à la racine pour compiler, packager et installer l'extension localement dans votre instance principale de VS Code :

```bash
npm run extension:install
```

---

## 🏗 Architecture (Monorepo)

-   **`packages/core`** : Coeur logique (API, Sync, Sanitization).
-   **`packages/cli`** : Interface de commande.
-   **`packages/vscode-extension`** : Plugin VS Code.

---

## 📄 Licence
MIT