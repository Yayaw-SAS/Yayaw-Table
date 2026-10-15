---
"yayaw-table-workspace": minor
---

Add `tagItem` and `onTagClick` to React and Vue tag columns. `tagItem(value, row)` gives each tag its label, a semantic tone (`neutral`, `success`, `warning`, `danger`, from the theme's `--yayaw-success`/`--yayaw-warning`/`--yayaw-danger`), an icon and a tooltip from the row's data, and values may be records. `onTagClick(value, row)` draws each tag as a button whose clicks never reach the row, inline editing or drag. Hosts no longer need a `cellRenderer` for data-driven tags.
