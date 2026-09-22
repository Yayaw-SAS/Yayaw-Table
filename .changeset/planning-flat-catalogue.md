---
"yayaw-table-workspace": patch
---

Read planning config from a flat catalogue entry. `getTableConfig` may return the behaviour nested
under `table` or flat at the top level, and `resolveTableCatalogueConfig` has always accepted both,
but the provider's planning derivation only read the nested shape and fell back to the default table
config for the flat one. A flat entry therefore lost its `planning` and `gantt` mapping, built no
planning session, and had the Gantt withheld from its view menu even though it was configured and
listed in `displayModes`.
