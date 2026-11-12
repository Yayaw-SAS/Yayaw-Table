---
"yayaw-table-workspace": patch
---

Vue server rendering asks the host for its actions (`getTableActions`) once, in setup. The `serverPrefetch` load no longer evaluates them again after its own awaits, where a host getter built on its framework's context (a Nuxt computed reading the session) has lost it. The browser still follows the getter.
