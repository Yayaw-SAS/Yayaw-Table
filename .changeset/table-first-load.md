---
"yayaw-table-workspace": patch
---

A table requests its first page once and mounts its view once, in both editions.

- **React mounts the view once, with the first page.** React derived its filters with an asynchronous query, so the page query started one render late: the first render showed an empty table that the loading state then replaced, and every view mounted twice. The File tree listed its root and each folder it opens twice at load, and the renderer context's `revision` started over. The table now shows its loading state from the first render until the first page answers, then mounts the view with the rows. Without `initialData`, the server renders that loading state too, instead of the empty state.
- **Vue views load their data once at load, and once per search.** The renderer context's `revision` moved when the first page arrived and when the URL read on mount set equal values, so the File tree listed its root three times and each folder it opens twice, and loaded a search's matches twice. `revision` now moves for a new query or list, and for new rows of the query shown (a mutation, a form submit, another page).

**Custom renderers.** Load at mount, then again when `revision` or the query in `listParams` changes. In Vue, `revision` no longer moves while the first page loads.
