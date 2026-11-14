---
"yayaw-table-workspace": minor
---

Selected and strong surfaces follow the theme in both editions.

- A linked number that is pressed (`kpiLinks`) is drawn on the theme's `accent` surface with `accent-foreground`, inside a `primary` outline, instead of a 5% tint of `primary`.
- The selected view tab uses `accent` / `accent-foreground`, and selected rows a softened `accent`, so every selected thing shares one theme surface. With shadcn's neutral theme, where `accent` equals `secondary` and `muted`, they look as before.
- The bulk action bar is a floating pill on `primary` with `primary-foreground`; its destructive action mixes `destructive` toward `primary-foreground` to stay readable on any primary.
- Tags: new `info` tone (`--yayaw-info`, else the theme's `--primary`); the `danger` tone follows the theme's `--destructive` when `--yayaw-danger` is not set; tinted tags keep a 4.5:1 text contrast with pale theme colors; `--yayaw-tag-radius` (for pills: `9999px`) and `--yayaw-tag-font-weight` shape every tag.
