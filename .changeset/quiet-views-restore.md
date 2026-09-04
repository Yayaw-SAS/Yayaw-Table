---
"yayaw-table-workspace": patch
---

Align the Vue saved-view manager with React: a compact current-view dropdown, save/add icon buttons, a save dialog, and contextual deletion. Preserve explicit empty grouping so saving or reloading a table view cannot activate its configured Kanban lanes. Restore partial views against catalogue defaults, preserve URL overrides and edits made during asynchronous persistence, pass table context to view actions, and expose recoverable localized errors. Keep legacy Vue translations and local-storage views compatible.
