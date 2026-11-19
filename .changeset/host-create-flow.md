---
"yayaw-table-workspace": minor
---

Add `onCreate` (React and Vue, `@create` in Vue): the create button and the views' new-row clicks open the host's own create flow (a dialog, a wizard, a page) instead of the built-in form. The button shows without `actions.create`; `table.allowCreate: false` still hides it, and Import keeps `actions.create`.
