# Yayaw Table – Shadcn Registry

Distribution **sans package npm** : tout le code est dans le registry. Les composants Shadcn utilisés sont déclarés en `registryDependencies`, le CLI les ajoute une seule fois (pas de duplication).

## CI (GitHub Actions)

Un job **Build registry** (`.github/workflows/build-registry.yml`) tourne sur chaque push sur `main` :

- exécute `bun run registry:build` (sync du code + `shadcn build` → `public/r/*.json`)
- commit et push de `public/r`, `registry/default` et `registry/registry.json` s’ils ont changé

Le site de doc (Next) sert tout ce qui est dans `public/` : une fois déployé, l’URL du block est `https://<ton-domaine>/r/yayaw-table.json`. C’est cette URL qu’on met dans la doc d’installation.

## En local

1. **Synchroniser** le code source vers le registry (après modification de `src/ui/yayaw_table` ou des composants dans `src/ui/custom`) :
   ```bash
   bun run registry:sync
   ```

2. **Builder** le registry (génère `public/r/*.json`) :
   ```bash
   bun run registry:build
   ```

## Où vont les fichiers quand on installe via la CLI ?

Quand on fait `npx shadcn@latest add <url-du-block>` (ex. `https://ton-domaine.com/r/yayaw-table.json`) :

1. **Composants Shadcn** (`registryDependencies`) : installés **d’abord** par le CLI dans le dossier défini par l’alias **`ui`** du `components.json` du projet. Ex. si `"ui": "@/ui/shadcn"` → `src/ui/shadcn/` (button, dialog, table, etc.).

2. **Fichiers du block yayaw-table** : le CLI utilise le `components.json` du projet pour déterminer la cible. En général, les fichiers du block sont placés dans un **sous-dossier du nom du block** sous l’alias correspondant au type de fichier :
   - types **registry:component** / **registry:lib** → alias **`components`** (souvent `@/components` → `src/components/`) ;
   - type **registry:hook** → alias **`hooks`** (souvent `@/hooks` → `src/hooks/`).

   Donc avec une config par défaut, tout le block atterrit typiquement sous un même dossier, par ex. **`src/components/yayaw-table/`** (ou équivalent selon la version du CLI), avec la structure : `atoms/`, `components/`, `config/`, `hooks/`, `providers/`, `types/`, `utils/`, `ui-custom/`.

3. **Imports dans le block** : le code du block importe `@/ui/shadcn/...` et `@/lib/utils`. Pour que ça résolve correctement, le projet doit avoir les alias **`@/ui`** (ou au moins `@/ui/shadcn` pour les primitives Shadcn) et **`@/lib`** comme dans son `components.json` / `tsconfig.json`.

En résumé : **Shadcn → `ui` (ex. `src/ui/shadcn/`)**, **block yayaw-table → sous-dossier dédié (ex. `src/components/yayaw-table/`)**. Pour une structure alignée avec ce repo, on peut configurer `"components": "@/components"` et `"ui": "@/ui/shadcn"` dans `components.json`.

## Structure

- `registry.json` : entrée du registry (un block `yayaw-table` avec `registryDependencies` Shadcn et `dependencies` npm).
- `default/yayaw-table/` : copie de `src/ui/yayaw_table` + `ui-custom` (loader, icon, stack-menu) depuis `src/ui/custom`, avec imports corrigés (relatifs entre fichiers du block, `@/ui/shadcn` et `@/lib/utils` pour le projet cible).

## Index officiel Shadcn

Pour apparaître dans la liste des registries (et permettre `shadcn add @yayaw/yayaw-table`) : [Add a Registry](https://ui.shadcn.com/docs/registry/registry-index) (PR sur le repo shadcn-ui/ui).
