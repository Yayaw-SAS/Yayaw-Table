---
"yayaw-table-workspace": minor
---

Inline searched `select` and `multiSelect` editors now offer the field's `createOption`: when the search names no existing option, the list ends with "Create "{label}"" (`inline.create_option`). A multi-select adds the created option to the selection; a single select saves it as the whole edit. Failures show in the list and keep the editor open.
