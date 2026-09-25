---
"yayaw-table-workspace": patch
---

React follows the page rules Vue already had, and a query that does not change keeps its page in both editions.

- **A new query starts on the first page (React).** A search, a column or advanced filter, or a sort changed in the table now returns to the first page, written in the same URL update as the new query. Before, a search from the second page showed an empty table and kept `<tableId>-page` in the URL. A link's page is still kept on arrival and on back and forward.
- **A page past the last one moves to the last page (React)** once `list` answers, whether it comes from an old link or rows were removed since. The table shows as loading until then. Before, it showed an empty page without pagination.
- **Repeating the current query keeps the page (React and Vue).** Choosing the current sort again (the column menu's "Ascending" on an ascending column) or a search that differs only by surrounding spaces no longer returns Vue to the first page.
- With a table id containing `sort` or `filters`, React wrote the search or the sort to the wrong URL key. Each now goes to its own key.

**Hosts.** Answer a `page` past the last one with `meta.totalCount` and `meta.pageCount` and no rows, not an error. Both editions then move to the last page those counts give and ask `list` for it.
