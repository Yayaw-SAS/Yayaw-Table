---
"yayaw-table-workspace": minor
---

Unify React and Vue responsive view menus. Desktop keeps one toolbar row with explicit data actions; mobile and constrained containers use view, create and a labelled data-action panel. View settings adapt to Table, Kanban and Gallery, with direct density and mode controls, accessible scrolling panels, and preserved inactive presentation settings.

Use normalized saved-view comparisons for the modified indicator and save availability. Add optional `footerCalculationsVisible` snapshots, restore saved or initial settings with Reset view, preserve drafts after persistence failures, and keep favorites independent of write permission. Share the current URL with native mobile sharing and clipboard fallback. Existing filter-only reset flags retain their behavior inside Filters.

Keep view panels mounted during React query refreshes, use content-sized Shadcn scroll areas, and restore empty grouping without importing an inactive Kanban lane. Preserve utility-column order and native table-cell layout in grouped results. Make the runnable previews apply the complete query and demonstrate actual onBulkEdit writes in both frameworks.

Keep advanced numeric filter drafts stable until Enter or confirmation, including zero, negative decimals and ranges. Remove stale delayed input callbacks, implicit numeric bounds and nested filter cards. Keep new Vue rules out of query state until applied and expose advanced filters in its runnable example.

Keep the mobile panel header fixed while focusing numeric inputs and anchor Vue column menus correctly when composed with tooltips.

Present display mode and density as matching labelled button rows, with equal-width choices and the same selected state in React and Vue.
