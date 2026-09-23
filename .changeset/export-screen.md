---
"yayaw-table-workspace": minor
---

Export opens a screen in View settings → Data, in React and Vue: format (CSV, PDF through the print dialog, Excel when `actions.exportFile` is provided), records (all in the view or the selection), columns (visible in order or all), values (as displayed — currency, dates, option labels — or raw) and the file name (table, saved view and day by default). With `actions.exportFile(request)` the server builds the file from the view's query (`list` shape), the chosen columns and options, and returns a download link or a Blob; otherwise the browser writes the CSV (UTF-8 with BOM) or prints a paginated table. `table.exportFormats` limits the formats offered; `onExport` still replaces the CSV file. File names drop accents.

The Data section now reads Export ›, Sync › and Share ›: destinations of kind `"sync"` (formerly `"export"`, still accepted) open under Sync, and share destinations under Share after the built-in "Copy link" (Share stays a direct action without them).
