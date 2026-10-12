---
"yayaw-table-workspace": patch
---

Vue: starting an inline edit no longer references the `HTMLSelectElement` global, so it also runs where no DOM globals exist (Node tests, server-side contract checks).
