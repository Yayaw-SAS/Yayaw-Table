---
"yayaw-table-workspace": minor
---

Vue: URL state for server-rendered tables. With `syncUrl`, the table now reads the URL during setup instead of on mount. The new `urlSearch` prop carries the request's query string to the server (in Nuxt: `useRequestURL().search`). The server then renders and prefetches the link's state, and the browser hydrates that same state without loading the page again. Without `urlSearch`, behavior is unchanged except that the browser applies the link's state before its first render. React already reads the URL on the server through nuqs.
