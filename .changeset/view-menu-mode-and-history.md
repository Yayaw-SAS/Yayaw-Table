---
"yayaw-table-workspace": minor
---

Saved views (React and Vue): the view menu starts with the current view's display mode, so an existing view's layout changes from its chevron menu. The change marks the view modified, and **Save changes** keeps it. With URL sync, choosing a view or **Reset view** now adds a browser history entry when it changes the URL: Back returns to the filters, sort and columns it replaced. Other table writes still replace the current entry. Vue's `applyView` and `reset` accept `{ history: "push" }` for the same behavior from host code.
