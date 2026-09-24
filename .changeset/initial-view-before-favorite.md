---
"yayaw-table-workspace": patch
---

A view named by the host or by a link opens on arrival without waiting for the favorite.

- **`initialActiveViewId`** (React and Vue): the view is applied once the saved views are loaded, without waiting for `actions.views.getFavorite`. In React, the column order the table writes to the URL right after mounting (`<tableId>-order`) used to count as "URL state" and cancel the initial view whenever the favorite answered later, which was every remote favorite. React now reads the incoming URL once on mount, as Vue does.
- **`?view=<id>` links** (React): a link that names only a saved view now applies that view's settings (display mode, filters, sort…), as Vue already did. It used to select the view's tab while the table kept its default settings.
