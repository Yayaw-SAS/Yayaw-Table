---
"yayaw-table-workspace": minor
---

Connectors can write in a chosen language. A Connect destination's `connector` accepts `languages` (`ConnectorLanguages`: `options`, optional `default` and `headers(locale)`); with two or more options the connector screen shows a "Language" select ("Langue") next to the columns choice, in React and Vue. The choice is saved and sent as the new `ConnectorSettings.locale` to `save`, `push`, `preview` and `sync` (the saved locale when still offered, else `default`, else the first option). Columns that become new target fields, including the columns of a target created with "Create one from this table’s columns…", are proposed under `headers(locale)[column.id]` instead of the interface header; changing the language renames only proposed names the target does not have yet, never its own fields or names chosen otherwise. Connectors without `languages` are unchanged. New label key: `language`.
