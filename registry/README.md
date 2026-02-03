# Yayaw Table – Shadcn Registry

Distribution **sans package npm** : tout le code est dans le registry. Les composants Shadcn utilisés sont déclarés en `registryDependencies`, le CLI les ajoute une seule fois (pas de duplication).

## Workflow

1. **Synchroniser** le code source vers le registry (après modification de `src/data-table` ou des composants ui-custom) :
   ```bash
   bun run registry:sync
   ```

2. **Builder** le registry (génère `public/r/*.json` pour le CLI) :
   ```bash
   bun run registry:build
   ```

3. **Servir** les JSON (via ton site de doc ou un déploiement) pour que les utilisateurs puissent faire :
   ```bash
   npx shadcn@latest add https://ton-site.com/r/yayaw-table.json
   ```

## Structure

- `registry.json` : entrée du registry (un block `yayaw-table` avec `registryDependencies` Shadcn et `dependencies` npm).
- `default/yayaw-table/` : copie de `src/data-table` + `ui-custom` (loader, icon, stack-menu), avec imports corrigés (relatifs entre fichiers du block, `@/components/ui` et `@/lib/utils` conservés pour le projet cible).

## Index officiel Shadcn

Pour apparaître dans la liste des registries (et permettre `shadcn add @yayaw/yayaw-table`) : [Add a Registry](https://ui.shadcn.com/docs/registry/registry-index) (PR sur le repo shadcn-ui/ui).
