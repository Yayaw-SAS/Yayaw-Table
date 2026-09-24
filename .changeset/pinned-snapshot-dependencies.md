---
"yayaw-table-workspace": patch
---

Pinned optional items install the core of the same version.

- **Versioned registry snapshots**: optional items (calendar, chart, dashboard and map, React and Vue) declared the table through its latest URL, even inside `r/vX.Y.Z/`. Installing a pinned optional item therefore also pulled the latest core and could overwrite a pinned core with another version. Snapshots now pin those dependencies to their own version (`r/vX.Y.Z/yayaw-table.json`, `r/vX.Y.Z/yayaw-table-vue.json`). Latest files and each item's `meta.registryUrl` are unchanged, and `release:verify` checks the pinned snapshot. Published snapshots up to v3.6.1 keep their previous content.
