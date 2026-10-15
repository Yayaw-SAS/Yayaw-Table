---
"yayaw-table-workspace": minor
---

The calendar and map modes are no longer offered on a table without a `date` (calendar) or `location` (map) column, in React and Vue. They used to open on an empty view; a host can now list every display mode on every table and let each table offer only the modes its columns can feed. A saved view or URL asking for a withheld mode falls back to the default mode, as for any mode the table does not offer.
