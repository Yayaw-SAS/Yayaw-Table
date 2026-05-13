# Traitement des warnings React Doctor

Ce document décrit comment traiter chaque catégorie de warnings (522 au total).  
Commande : `npx -y react-doctor@latest .`

---

## 1. Dead code (Knip) — 235 + 136 + 81 ≈ 452 warnings

| Règle | Count | Action recommandée |
|-------|--------|---------------------|
| **knip/files** (fichiers inutilisés) | 235 | **Option A** : Supprimer les fichiers vraiment morts. **Option B** : Exclure dans `knip.json` les dossiers connus (ex. `registry/`, `.source/`, composants UI non utilisés dans ce repo mais exposés par le registry). |
| **knip/exports** (exports inutilisés) | 136 | Supprimer les exports inutilisés ou les garder si c’est une API publique (ex. `Field`, `useFieldId`). Pour le registry, les exports sont souvent consommés par les projets qui installent le package. |
| **knip/types** (types inutilisés) | 81 | Supprimer les types non utilisés ou les garder pour l’API publique. |

**Priorité** : Basse si le code est une lib/registry ; moyenne si vous voulez un bundle plus propre.

---

## 2. State & Effects

| Règle | Count | Fichiers | Action |
|-------|--------|----------|--------|
| **no-derived-useState** | 4 | `advanced-filter-panel.tsx` (src + registry) | Soit composant 100 % contrôlé (parent passe `isEditing` + `onEditingChange`), soit garder le sync en rendu et accepter le warning. |
| **no-effect-event-handler** | 4 | `table-menu.tsx`, `table-columns-menu.tsx` | Déplacer la logique des `useEffect` concernés vers des vrais handlers (`onClick`, `onChange`, etc.). |
| **no-cascading-set-state** | 1 | `app/[locale]/example/page.tsx` | Regrouper les 4 `setState` dans un seul `useReducer` (ou un seul `setState` avec un objet). |
| **prefer-useReducer** | 2 | `filter-presets-panel.tsx` (SavePresetDialog) | Regrouper les 5 `useState` liés dans un `useReducer`. |
| **rendering-hydration-no-flicker** | 7 | `theme-toggle`, `column-header`, `table-component`, `safe-pagination` | Pour état venant du DOM/localStorage : `useSyncExternalStore` ou `suppressHydrationWarning` sur l’élément qui flashe. |

---

## 3. Correctness

| Règle | Count | Fichiers | Action |
|-------|--------|----------|--------|
| **no-array-index-as-key** | 1 | `slider.tsx` | Déjà corrigé avec `key={\`slider-thumb-${index}\`}`. Si le linter exige un identifiant “métier”, utiliser un id dérivé des valeurs (ex. `value`) si disponible. |
| **no-prevent-default** | 4 | `advanced-filter-panel`, `form-builder` | Pour améliorer la robustesse : ajouter `action` + Server Action ou `requestSubmit()` et éviter de tout faire dans `onSubmit` avec `preventDefault`. Sinon, documenter le choix. |
| **react/no-danger** | 1 | `chart.tsx` | Remplacer ou encapsuler `dangerouslySetInnerHTML` (sanitization ou composant dédié). |

---

## 4. Architecture

| Règle | Count | Action |
|-------|--------|--------|
| **no-giant-component** | 21 | Découper les gros composants (ex. DataTableAdvancedToolbar, table-component, filter-presets-panel, inline-editable-cell) en sous-composants nommés. |
| **no-render-in-render** | 14 | Extraire les fonctions de rendu inline (ex. `renderMainMenuView()`, `renderRegularCellContent()`) en composants nommés pour une réconciliation stable. |

---

## 5. Bundle size & perf

| Règle | Count | Fichiers | Action |
|-------|--------|----------|--------|
| **prefer-dynamic-import** | 1 | `chart.tsx` (recharts) | Charger recharts en dynamique : `const Chart = dynamic(() => import('…'), { ssr: false })`. |
| **use-lazy-motion** | 1 | `image-upload.tsx` (framer-motion) | Utiliser `LazyMotion` + `m` avec `domAnimation` au lieu de `motion` pour réduire le bundle. |

---

## 6. Next.js

| Règle | Count | Fichiers | Action |
|-------|--------|----------|--------|
| **nextjs-missing-metadata** | 1 | `app/[locale]/example/page.tsx` | Ajouter `export const metadata = { title: '…', description: '…' }` ou `generateMetadata`. |

---

## 7. Autres (memo / props)

| Règle | Count | Fichiers | Action |
|-------|--------|----------|--------|
| **no-inline-prop-on-memo-component** | 8 | `column-menu.tsx` (src + registry) | Les icônes sont déjà passées en composant. Les 8 restants concernent des **callbacks** (ex. `onClick={() => …}`). Passer des callbacks stables (ex. `useCallback`) depuis le parent pour éviter de casser le memo. |

---

## Ordre de traitement suggéré

1. **Quick wins** (peu de code, impact clair)  
   - nextjs-missing-metadata (example page)  
   - use-lazy-motion (image-upload)  
   - prefer-dynamic-import (chart)  
   - react/no-danger (chart)  

2. **State & effects** (qualité de la logique)  
   - no-effect-event-handler  
   - no-cascading-set-state (example page)  
   - prefer-useReducer (SavePresetDialog)  
   - rendering-hydration-no-flicker (au besoin)  

3. **Forms & correctness**  
   - no-prevent-default (optionnel, selon stratégie formulaire)  

4. **Refactors plus lourds**  
   - no-render-in-render (extraire composants)  
   - no-giant-component (découpage progressif)  
   - no-derived-useState (advanced-filter-panel, si vous voulez un composant 100 % contrôlé)  

5. **Dead code (Knip)**  
   - À traiter en dernier ou avec des exclusions ciblées (registry, API publique).  

Après chaque lot de changements : `bun run registry:sync` puis `npx -y react-doctor@latest .` pour vérifier.

---

## Traitement par lot (outils)

### Knip (fichiers / exports / types inutilisés)

- **Exclure des chemins** : dans `knip.json` (ou la config utilisée par React Doctor), ajouter des `ignore` pour `registry/`, `.source/`, ou des fichiers volontairement non référencés (ex. composants UI exposés par le registry).
- **Exports publics** : ne pas supprimer les exports qui font partie de l’API publique du package ; les marquer comme utilisés ou les exclure des règles Knip si besoin.
- **Nettoyage ciblé** : lancer Knip seul pour lister les entrées, puis supprimer ou exclure au cas par cas.

### Composants trop gros (no-giant-component)

- Découpage progressif : extraire des blocs logiques en sous-composants (ex. `ToolbarSection`, `FilterChipList`).
- Garder les extractions dans le même fichier d’abord, puis déplacer dans des fichiers dédiés si nécessaire.

### Forms (no-prevent-default)

- Soit ajouter une Server Action dans `action` et garder `onSubmit` pour le feedback client (toast, etc.).
- Soit documenter le choix (SPA, pas de fallback sans JS) et accepter le warning.

### Hydration (rendering-hydration-no-flicker)

- Pour état dérivé du DOM / `localStorage` : préférer `useSyncExternalStore` avec `getServerSnapshot` pour éviter le flash.
- Si le flash est acceptable (ex. thème), on peut ajouter `suppressHydrationWarning` sur l’élément concerné au lieu de changer toute la logique.

### Réduire le nombre de warnings sans tout corriger

- **React Doctor** : pas d’option “fix” globale ; chaque règle doit être traitée manuellement ou via les suggestions du rapport.
- **Prioriser** : corriger d’abord les règles “Correctness” et “State & Effects”, puis “Bundle size”, puis “Architecture” et “Dead code”.
- **Ignorer** : si une règle ne s’applique pas (ex. metadata déjà dans le layout), on peut ignorer le warning ; le guide ci‑dessus indique où c’est le cas.
