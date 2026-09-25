---
"yayaw-table-workspace": patch
---

Vue keeps the page a link opens on, as React does. A link such as `?<tableId>-page=1` showed the first page and lost the key from the URL, because reading the link's search, filters and sort counted as a new query; back and forward returned to the first page too. A search, filter or sort changed in the table, a saved view, clearing the filters and resetting the view still start on the first page.
