# 📂 Fichier de Passation - Projet "n8n-as-code"

**Destinataire :** Agent IA (Cline, Roo, Cursor, Claude).
**Contexte :** Démarrage de la phase de migration vers une architecture Monorepo.

## 🎯 Vision du Projet
Créer un écosystème complet (`Core` + `CLI` + `VS Code Extension`) permettant de gérer les workflows n8n comme du code, avec une synchronisation bidirectionnelle et une forte intégration IA.

**Règle d'Or :** La source unique de vérité est le fichier `MASTER_SPECS.md`. Réfère-toi s'y pour chaque décision d'architecture.

---

## 🏗 État Actuel & Objectif

* **Actuel :** Un prototype d'extension VS Code existe dans un dossier `vscode-extension`, et des scripts isolés.
* **Cible :** Une architecture **Monorepo (NPM Workspaces)** propre.

---

## 🚀 Ta Mission (Roadmap Immédiate)

Exécute ces tâches strictement dans l'ordre. Coche-les une fois terminées.

### Phase 1 : Initialisation du Monorepo
- [ ] Créer la structure de dossiers racine : `packages/core`, `packages/cli`, `packages/vscode-extension`.
- [ ] Initialiser le `package.json` racine avec `"workspaces": ["packages/*"]`.
- [ ] Configurer le `tsconfig.base.json` pour permettre les imports entre packages.

### Phase 2 : Migration du "Core" (Le Cerveau)
- [ ] Initialiser `packages/core` (TypeScript library).
- [ ] Migrer la logique de `N8nApiClient` (actuellement dans l'extension) vers ce package.
- [ ] Créer la classe `WorkflowSanitizer` (selon specs).
- [ ] Créer le `SyncManager` (logique de hash MD5).

### Phase 3 : Création du CLI
- [ ] Initialiser `packages/cli`.
- [ ] Créer une commande de test `n8n sync status` qui utilise le `Core`.

### Phase 4 : Connexion de l'Extension
- [ ] Déplacer le code de l'extension existante dans `packages/vscode-extension`.
- [ ] Remplacer les appels API internes par des appels au package `@n8n-as-code/core`.

---

## ⚠️ Contraintes Techniques (CRITIQUE)

1.  **Dépendances :** Le package `core` ne doit JAMAIS dépendre de `vscode`. Il doit être agnostique.
2.  **Stratégie IA :** N'oublie pas d'implémenter la logique de génération de `AGENTS.md` dans le Core (voir specs "Context Injection").
3.  **Nettoyage :** Ne supprime pas l'ancien code (`synced_workflows`, scripts) tant que le portage vers le Monorepo n'est pas validé.

---

Bonne chance ! 🤖