---
"yayaw-table-workspace": minor
---

Custom export and share destinations in React and Vue: declare `destinations` in the table actions (`{ id, label, kind: "export" | "share", icon?, hidden?, requiresSelection?, run(context) }`) and they appear in the View settings "Data" section, after the CSV export or the share link. `run` receives the view's query in the `list` shape (search, filters, active advanced filters and their combination, sorting), the view id, the visible columns in order, the selected row ids, the view's link and `loadRows()` for every matching record — so a webhook, an n8n workflow or a connector can fetch the data server-side. One destination runs at a time with a busy state; its `message` shows as a success toast and a thrown error as an error toast. New `table.share: false` hides the built-in share link.
