# 📘 Master Specifications : n8n-as-code Ecosystem

**Version** : 2.0 (Architecture Monorepo & Deep-Sync)  
**Statut** : Référence Technique Absolue

Ce document est la source unique de vérité ("The Bible"). Il définit l'architecture complète, les algorithmes de synchronisation, le nettoyage des données et la stratégie d'intégration IA pour l'écosystème n8n-as-code.

## 1. Vision et Architecture Globale

### 1.1. Philosophie

"Code First, Visual Feedback".

L'objectif est de déporter la logique de n8n (habituellement visuelle) vers des fichiers textes versionnables, manipulables par des humains ou des Agents IA, tout en garantissant une synchronisation bidirectionnelle robuste.

### 1.2. Structure Monorepo (NPM Workspaces)

Le projet est divisé en trois paquets distincts pour assurer la séparation des préoccupations et l'usage autonome.
```
/ (Racine du Repo)
├── package.json           # Workspaces: ["packages/*"]
├── AGENTS.md              # Fichier maître de contexte IA (Généré)
├── .gitignore
└── packages/
    ├── core/              # [LIBRARY] Le Cerveau (Logique pure, sans UI)
    ├── cli/               # [CLIENT] Interface Terminal (Mode Headless)
    └── vscode-extension/  # [CLIENT] Interface VS Code (Mode Riche)
```

## 2. Le Cœur du Système : packages/core

C'est la librairie TypeScript partagée. Elle ne doit avoir aucune dépendance à VS Code (vscode module forbidden).

### 2.1. Services Clés

#### A. N8nApiClient (Communication)

Wrapper autour d'Axios pour interagir avec l'API n8n.

- **Auth** : Supporte API Key et Basic Auth via une interface `ICredentialsProvider`
- **Endpoints utilisés** :
  - `GET /workflows` : Lister (Light payload)
  - `GET /workflows/{id}` : Récupérer le JSON complet
  - `PUT /workflows/{id}` : Mettre à jour un workflow
  - `POST /workflows` : Créer un nouveau workflow
  - `POST /workflows/{id}/activate` : Changer l'état actif/inactif
  - `GET /node-types` : Récupérer les schémas de nœuds (Introspection)

#### B. WorkflowSanitizer (Nettoyage JSON)

Crucial pour éviter le bruit dans Git.

- **Input** : JSON brut venant de l'API n8n
- **Opérations de Nettoyage (Stripping)** :
  - Suppression des `settings.executionUrl` (spécifique à l'instance)
  - Normalisation de l'ordre des clés (pour que le diff Git soit propre)
  - Optionnel : Extraction des `pinData` vers un fichier séparé (pour alléger le JSON)
- **Output** : "Clean JSON" prêt à être sauvegardé sur le disque

#### C. SyncManager (Algorithme de Synchronisation)

Gère l'état et détecte les changements.

**Logique de Comparaison** :
- Calcule un Hash MD5 du fichier local (sur disque)
- Calcule un Hash MD5 du workflow distant (via polling ou webhook)

**États Déduits** :
- `SYNCED` : Hash Local == Hash Distant
- `LOCAL_MODIFIED` : Hash Local != Hash Remote (et date modif locale > dernière sync)
- `REMOTE_MODIFIED` : Hash Local != Hash Remote (et date modif distante > dernière sync)
- `CONFLICT` : Les deux ont changé sans sync intermédiaire

#### D. SchemaGenerator & AiContextGenerator

Prépare le terrain pour l'IA.

- Interroge l'instance pour obtenir la liste exacte des nœuds installés
- Génère un fichier JSON Schema standard (`n8n-schema.json`)
- Génère les fichiers de règles (`AGENTS.md`, `.cursorrules`)

## 3. Spécifications Fonctionnelles & UX

### 3.1. Interface VS Code (packages/vscode-extension)

L'extension est une couche UI fine par-dessus le Core.

#### A. Mécanisme "Push on Save" (Critique)

1. L'utilisateur (ou l'IA) modifie un fichier `.n8n.json`
2. Événement `vscode.workspace.onDidSaveTextDocument` déclenché
3. **Action Extension** :
   - Appelle `Core.WorkflowParser.validate(json)`
   - Si valide, appelle `Core.N8nApiClient.updateWorkflow(id, json)`
   - Affiche une notification "Toast" en bas à droite : "✅ Workflow pushed to n8n"
   - Rafraîchit la WebView n8n si elle est ouverte

#### B. Vue "Workflow Explorer" (Sidebar)

- **Data Source** : `TreeDataProvider` alimenté par `Core.SyncManager.getWorkflows()`
- **Polling** : Rafraîchissement automatique toutes les 60s (configurable) pour détecter les changements distants
- **Icônes Contextuelles** :
  - 🟢 (Check) : Synced
  - 🔵 (Pencil) : Local edit
  - 🟠 (Cloud) : Remote change
  - 🔴 (Warning) : Conflict

#### C. Vue "Visual Bridge" (Webview)

- Intégration d'une iframe pointant vers l'URL du workflow (`{baseUrl}/workflow/{id}`)
- **Communication inter-processus** : La Webview écoute les messages de l'extension pour se recharger (`reload()`) après un Push on Save

### 3.2. Interface CLI (packages/cli)

Pour les environnements sans UI (CI/CD, Vim, SSH).

#### Commande `n8n sync watch`

- Démarre un processus persistant
- Utilise `chokidar` pour surveiller le dossier local
- Utilise un `setInterval` pour poller l'API n8n
- **Output Console** : Utilise `chalk` et `ora` pour un feedback visuel riche
```
[WATCH] 👀 Watching ./workflows
[SYNC]  ⚡ Uploaded 'MyWorkflow.json' (Checksum match)
[ALERT] ⚠️  Remote change detected on 'Database_Backup' -> Run 'n8n pull' to update.
```

## 4. Stratégie IA : "Context Injection" (No-MCP)

Nous n'utilisons pas de serveur MCP complexe. Nous utilisons l'injection de fichiers statiques que les agents lisent nativement.

### 4.1. Génération du Schéma (n8n-schema.json)

Au démarrage (`init-ai`), le Core récupère les définitions brutes des nœuds (NodeTypes). Il transforme cela en un schéma JSON officiel qui valide :
- Les noms de nœuds (`type`)
- Les paramètres obligatoires (`parameters`)
- La structure des connexions

### 4.2. Génération de AGENTS.md (La Bible de l'IA)

Fichier généré à la racine du projet utilisateur.

- **Rôle** : "Expert n8n Automation Engineer"
- **Contexte Instance** : "Tu es connecté à une instance n8n version X.Y.Z. Nœuds communautaires installés : [Liste]."
- **Règles de Syntaxe** : Rappel des expressions `{{ $json.key }}`

### 4.3. Adaptateurs Spécifiques

Le Core génère des pointeurs pour forcer les IDEs à lire AGENTS.md.

- **Cursor** : `.cursorrules` → "READ AGENTS.md BEFORE CODING."
- **Cline/Roo** : `.clinerules` → "READ AGENTS.md."

## 5. Plan de Migration (Step-by-Step)

### Étape 1 : Initialisation Monorepo

- Créer la structure de dossiers racine
- Configurer `package.json` avec `"workspaces": ["packages/*"]`
- Configurer `tsconfig.base.json` pour la compilation partagée

### Étape 2 : Migration vers packages/core

- Extraire `n8nApiClient` du code existant
- Créer la classe `WorkflowSanitizer` (implémenter la logique de nettoyage des IDs/Time)
- Exporter ces classes via `index.ts`

### Étape 3 : Migration vers packages/vscode-extension

- Déplacer l'extension existante dans ce dossier
- Remplacer les appels API directs par des imports du paquet `@n8n-as-code/core`
- Implémenter le `onDidSaveTextDocument` en utilisant le `SyncManager`

### Étape 4 : Création du CLI

- Implémenter une commande simple `n8n sync` qui utilise le `SyncManager` du Core

## 6. Détails Techniques & Conventions

- **Langage** : TypeScript Strict Mode partout
- **Gestion des Secrets** :
  - CLI : Fichier `.env` ou Config Store système (`conf`)
  - VS Code : API native `vscode.secrets` (plus sécurisé)
- **Format de Fichier** : Les workflows sont toujours sauvegardés en `{Nom_Du_Workflow}.n8n.json`. Les espaces sont remplacés par des underscores.
- **Logs** : Le Core émet des événements de log génériques. L'Extension les affiche dans l'Output Channel, le CLI les affiche dans stdout.