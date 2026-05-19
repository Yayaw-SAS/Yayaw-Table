# Yayaw Table – Shadcn Registry

Distribution **sans package npm** : tout le code est dans le registry. Les composants Shadcn utilisés sont déclarés en `registryDependencies`, le CLI les ajoute une seule fois (pas de duplication).

**Source de vérité :** seul `src/components/ui/yayaw-table` (et les fichiers listés dans `src/components/ui/custom`) est à maintenir. Le dossier `registry/default/ui/yayaw-table` est **généré** par le script et ne doit pas être modifié à la main. Après toute modification sous `src/components/ui/yayaw-table`, exécuter `bun run registry:sync`. Le script lance ensuite `ultracite fix` sur `registry/default` pour que le code généré respecte le style du projet (plus besoin de lancer un fix à la main).

## CI (GitHub Actions)

Un job **Build registry** (`.github/workflows/build-registry.yml`) tourne sur chaque push sur `main` :

- exécute `bun run registry:build` (sync du code + `shadcn build` → `public/r/*.json`)
- commit et push de `public/r`, `registry/default` et `registry/registry.json` s’ils ont changé

Le site de doc (Next) sert tout ce qui est dans `public/` : une fois déployé, l’URL du block est `https://<ton-domaine>/r/yayaw-table.json`. La racine `https://<ton-domaine>` renvoie aussi ce block quand la requête vient de la CLI shadcn v4 (`Accept: application/vnd.shadcn.v1+json` ou `User-Agent: shadcn`), tout en gardant le site HTML pour les navigateurs.

## En local

1. **Synchroniser** le code source vers le registry (après modification de `src/components/ui/yayaw-table` ou des composants dans `src/components/ui/custom`) :
   ```bash
   bun run registry:sync
   ```

2. **Builder** le registry (génère `public/r/*.json`) :
   ```bash
   bun run registry:build
   ```

3. **Préparer une release versionnée** (génère aussi `public/r/vX.Y.Z/yayaw-table.json` pour la version courante de `package.json`) :
   ```bash
   bun run registry:release
   ```

## Versioning

Le registry a deux URLs publiques :

- `https://table.yayaw.app/r/yayaw-table.json` : canal `latest`, mis à jour à chaque build de registry.
- `https://table.yayaw.app/r/vX.Y.Z/yayaw-table.json` : snapshot immuable d'une release.
- `https://table.yayaw.app` : raccourci CLI v4 par négociation de contenu, équivalent à l'item `yayaw-table`.

Le registry publie aussi deux items optionnels CLI v4 :

- `font-yayaw-sans` (`registry:font`) : installe Plus Jakarta Sans comme `--font-sans`.
- `yayaw-table-base` (`registry:base`) : configure une base Shadcn YaYaw (`base-vega`, `lucide`, TypeScript/RSC, neutral, namespace `@yayaw`) et installe la font optionnelle + YaYaw Table.

Ces items sont additifs : l'installation directe de `yayaw-table` reste le chemin par défaut et ne force ni base ni font.

Les versions suivent SemVer depuis `package.json`. Les notes de release sont gérées avec Changesets :

```bash
bun run changeset
bun run version
```

`bun run version` applique les changesets, met à jour `CHANGELOG.md`, régénère le registry, puis crée le snapshot `public/r/vX.Y.Z/`. Ne modifiez jamais un dossier `public/r/vX.Y.Z/` existant pour changer le contenu d'une version déjà publiée : faites un nouveau bump de version.

## Où vont les fichiers quand on installe via la CLI ?

Quand on fait `npx shadcn@latest add <url-du-block>` (ex. `https://ton-domaine.com/r/yayaw-table.json`) :

1. **Composants Shadcn** (`registryDependencies`) : installés **d’abord** par le CLI dans le dossier défini par l’alias **`ui`** du `components.json` du projet. Ex. si `"ui": "@/components/ui"` → `src/components/ui/` (button, dialog, table, etc.).

2. **Fichiers du block yayaw-table** : chaque fichier généré déclare un `target`, donc le CLI installe tout le block sous **`components/ui/yayaw-table/`** dans le projet consommateur, indépendamment du type `registry:component`, `registry:lib` ou `registry:hook`.

3. **Imports dans le block** : le code du block importe `@/components/ui/...` et `@/lib/utils`. Pour que ça résolve correctement, le projet doit avoir les alias **`@/components`** et **`@/lib`** dans `components.json` / `tsconfig.json`.

En résumé : **Shadcn → `ui` (ex. `src/components/ui/`)**, **block yayaw-table → sous-dossier dédié (ex. `src/components/yayaw-table/`)**. Pour une structure alignée avec ce repo, on peut configurer `"components": "@/components"` et `"ui": "@/components/ui"` dans `components.json`.

## Structure

- `registry.json` : entrée du registry (un block `yayaw-table` avec `registryDependencies` Shadcn et `dependencies` npm).
- `font-yayaw-sans` et `yayaw-table-base` : items optionnels de la CLI shadcn v4.
- `default/components/ui/yayaw-table/` : **généré** par `scripts/build-registry.mjs` à partir de `src/components/ui/yayaw-table` + `ui-custom` (loader, icon, stack-menu) depuis `src/components/ui/custom`, avec imports transformés pour le CLI (`@/components/ui/*`, etc.). Le script exécute ensuite `ultracite fix` sur ce dossier. Ne pas éditer ce dossier à la main.

## Index officiel Shadcn

Pour apparaître dans la liste des registries (et permettre `shadcn add @yayaw/yayaw-table`) : [Add a Registry](https://ui.shadcn.com/docs/registry/registry-index) (PR sur le repo shadcn-ui/ui).
