# Yayaw Table – Shadcn Registry

Distribution **sans package npm** : tout le code est dans le registry. Les composants Shadcn utilisés sont déclarés en `registryDependencies`, le CLI les ajoute une seule fois (pas de duplication).

## CI (GitHub Actions)

Un job **Build registry** (`.github/workflows/build-registry.yml`) tourne sur chaque push sur `main` :

- exécute `bun run registry:build` (sync du code + `shadcn build` → `public/r/*.json`)
- commit et push de `public/r`, `registry/default` et `registry/registry.json` s’ils ont changé

Le site de doc (Next) sert tout ce qui est dans `public/` : une fois déployé, l’URL du block est `https://<ton-domaine>/r/yayaw-table.json`. C’est cette URL qu’on met dans la doc d’installation.

## En local

1. **Synchroniser** le code source vers le registry (après modification de `src/data-table` ou des composants ui-custom) :
   ```bash
   bun run registry:sync
   ```

2. **Builder** le registry (génère `public/r/*.json`) :
   ```bash
   bun run registry:build
   ```

## Structure

- `registry.json` : entrée du registry (un block `yayaw-table` avec `registryDependencies` Shadcn et `dependencies` npm).
- `default/yayaw-table/` : copie de `src/data-table` + `ui-custom` (loader, icon, stack-menu), avec imports corrigés (relatifs entre fichiers du block, `@/components/ui` et `@/lib/utils` conservés pour le projet cible).

## Index officiel Shadcn

Pour apparaître dans la liste des registries (et permettre `shadcn add @yayaw/yayaw-table`) : [Add a Registry](https://ui.shadcn.com/docs/registry/registry-index) (PR sur le repo shadcn-ui/ui).
