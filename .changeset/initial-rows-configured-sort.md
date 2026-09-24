---
"yayaw-table-workspace": patch
---

Show a host's initial rows at once when the table starts from `columns.sort`.

- **Initial rows under the configured sort** (React regression from 3.6.1): since React starts from `columns.sort`, a table given both `columns.sort` and `initialData` (a server-rendered first page) ignored those rows, because they were used only when no sort was set. The server rendered no rows and the client showed skeletons until its first request. The configured sort now counts as the table's default state: the rows render on the server and in the first client render, then the first page loads again once on mount in that sort, as in Vue.
- **`initialDataSort`** (React and Vue, optional): the sort the host produced `initialData` with. When it is `columns.sort` (`[]` for a table without one) and the table starts there, the rows are current and neither edition requests that page on mount. Hosts that order their first page by `columns.sort` can pass it to skip that request.
