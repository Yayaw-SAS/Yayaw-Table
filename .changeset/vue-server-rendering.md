---
"yayaw-table-workspace": minor
---

Server rendering in any starting state, the same view, page and date contracts in React and Vue.

- **Vue `serverPrefetch`**: the table loads its first page during the server rendering (`onServerPrefetch`), with its tag catalogs, in the state it starts from (the default view or `initialView`), and renders the rows. Pass the request's `queryClient` and dehydrate it into the page: the browser hydrates the rows without a second `list` while the client's `staleTime` holds them fresh. A server failure renders the loading state and the browser loads the page. Without `serverPrefetch`, the server renders the loading state and requests nothing (rows, footers, facets, tags, folders, server boards and renderer modes used to start requests nobody awaited).
- **A fresh starting page in the `queryClient` is current (Vue)**: a table whose client holds its starting page fresh (its `staleTime`, 0 by default, so nothing changes by default) shows it without a request, as React's `useQuery` does.
- **`initialFavoriteViewId` and `initialViewsLoaded` (React and Vue)**: the host's views and favorite are the whole list; the view manager starts loaded and asks neither `views.list` nor `views.getFavorite` on mount. A view the table already shows is not selected again (Vue loaded its rows twice).
- **`initialView.pageIndex` (React and Vue)** opens another page than the first.
- **`table.timeZone` (React and Vue)**: date columns without a `timeZone` of their own take the table's, so the server and the browser show the same times.
- **A smaller first page without a request (React and Vue)**: on the first page, a smaller page size of the same query (automatic page size measuring fewer rows than were rendered) shows the first rows already loaded; a larger one loads.
- **Vue reads browser state on mount**: the column drag preference (with the view order and the favorite fallback, already read on mount), and mounts renderer display modes (Feed, Calendar, Chart, Map, File tree, Form) right after hydration.
- **Vue hydration**: the empty header of the actions column no longer breaks the hydration of the column menus.

**Migration.** None required. Nuxt hosts register the table in a universal plugin (not `.client`) to render it on the server; see the Vue README's server rendering section.
