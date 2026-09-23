---
"yayaw-table-workspace": minor
---

Optional server connectors for Notion and Google Sheets, shipped as framework-agnostic registry items for React (`yayaw-table-connector-notion`, `yayaw-table-connector-google-sheets`) and Vue (`yayaw-table-vue-connector-notion`, `yayaw-table-vue-connector-google-sheets`). They share `connector-model.ts` (columns, rows, mapping, push result, typed `ConnectorError` codes and an HTTP helper with Retry-After, backoff and per-operation rate limiting) and run in Node 20+, Bun, Deno and edge runtimes through `fetch` and Web Crypto. Notion upserts pages keyed by a "Yayaw ID" property; Google Sheets signs service account assertions with `crypto.subtle` and upserts or replaces rows in a tab without reordering the user's columns. The table items do not include them, and the host keeps credential storage, authorization and workers (see `docs/connectors.md`).
