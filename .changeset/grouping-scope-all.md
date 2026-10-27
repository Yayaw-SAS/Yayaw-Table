---
"yayaw-table-workspace": minor
---

Add `table.groupingScope` to group every row matching the current search, filters and sort instead of only the page shown. With `groupingScope: "all"`, an active grouping loads all matching rows through `actions.list` (100 per request, up to `table.groupingMaxRows`, default 2000), shows them on one page without pagination, and says when the groups stop at the cap. The default `"page"` keeps today's behavior. React and Vue behave alike.
