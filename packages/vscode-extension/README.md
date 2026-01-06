<p align="center">
  <img src="https://raw.githubusercontent.com/EtienneLescot/n8n-as-code/main/assets/logo.png" alt="n8n-as-code logo" width="120" />
</p>

# 🚀 n8n-as-code : VS Code Extension

**n8n-as-code** transforme VS Code en un IDE surpuissant pour vos workflows n8n. Vos automations deviennent du code : versionning Git, édition assistée par IA et synchronisation transparente.

---

## ⚡ Quick Start

1.  **Installation** : Installez l'extension depuis le Marketplace.
2.  **Connexion** : Cliquez sur l'icône **n8n** dans la barre d'activité, puis sur la **roue crantée (⚙️)** pour configurer votre `Host` et `API Key`.
3.  **Import** : Utilisez le bouton rafraîchir (**Pull Workflows**) pour rapatrier vos workflows existants.

---

## 🎨 Fonctionnalités

### 🔄 Synchronisation Native
L'extension synchronise vos modifications en temps réel. Par défaut, chaque sauvegarde (`Ctrl+S`) du fichier JSON envoie instantanément les changements vers votre instance n8n.

### 🤖 Assistance IA Intégrée
Votre environnement est automatiquement configuré pour l'IA dès l'ouverture :
-   **Validation JSON** : Schéma n8n appliqué pour une aide à la saisie et une détection d'erreurs en direct.
-   **Bibliothèque de Snippets** : Modèles de nœuds prêts à l'emploi (`node:webhook`, `node:code`, etc.).
-   **Contexte `AGENTS.md`** : Instructions générées pour que Cline, Cursor, Windsurf, Antigravity ou Copilot maîtrisent la structure de vos workflows.

### 🍱 Vue Divisée (Split View)
Visualisez le canvas n8n en temps réel grâce à la Webview intégrée tout en éditant le code JSON. C'est l'interface idéale pour valider visuellement vos modifications structurelles.

---

## ⚙️ Configuration

L'extension utilise les paramètres natifs de VS Code (accessibles via la roue crantée ⚙️) :

| Paramètre | Description | Défaut |
| :--- | :--- | :--- |
| `n8n.host` | URL de votre instance n8n | - |
| `n8n.apiKey` | Votre clé API n8n | - |
| `n8n.syncMode` | `auto` (push à la sauvegarde) ou `manual` | `auto` |
| `n8n.syncFolder` | Dossier local de stockage | `workflows` |
| `n8n.pollInterval`| Fréquence de rafraîchissement (ms) | `3000` |

---

## 📄 Licence
MIT



