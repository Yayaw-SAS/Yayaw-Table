---
"yayaw-table-workspace": patch
---

Handle per-mode settings generically. The display mode registry now declares which modes keep their settings through a shared normalizer (the List for now); saved views, URLs (`<tableId>-<mode>`), table config types and table state loop over the registry in React and Vue instead of wiring each mode by hand. Existing URL keys and saved views are unchanged.
