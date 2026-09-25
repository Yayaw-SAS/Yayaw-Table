---
"yayaw-table-workspace": patch
---

React returns to the first page when a search, a column or advanced filter, or a sort changes in the table, as Vue does: a search from the second page showed an empty table and kept `<tableId>-page` in the URL. The first page is written in the same URL update as the new query, and a link's page is still kept on arrival and on back and forward. A page past the last one, from an old link or after rows are removed, now moves to the last page once `list` answers, instead of showing an empty page without pagination. In both editions, a write that repeats the current query (the current sort chosen again, a search with surrounding spaces) keeps the page. React also writes the search, filters and sort to their own URL keys when the table id contains `sort` or `filters`.
