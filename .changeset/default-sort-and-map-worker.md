---
"yayaw-table-workspace": patch
---

Start React tables from `columns.sort`, as Vue does, and document self-hosting MapLibre's worker with its shared file.

- **Default sort parity**: React now starts from the configured `columns.sort` when neither the URL nor a view sets a sort, in every mode (table, Kanban, Gallery, Gantt…), and its reset returns to it, as Vue already did. It used to start with no sort, so a host that orders by id when nothing is sorted showed React by id and Vue by the configured column. Without `columns.sort` both editions send no sort and keep the order `list` returns (Feed still asks for its date column, newest first).
- **Map worker**: MapLibre 6's `maplibre-gl-worker.mjs` imports `./maplibre-gl-shared.mjs` from its own folder. A self-hosted `table.map.workerUrl` needs both files from `node_modules/maplibre-gl/dist/` in the same folder; the README, registry notes and `workerUrl` docs say so.
