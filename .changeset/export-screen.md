---
"yayaw-table-workspace": minor
---

Export opens a screen in View settings → Data, in React and Vue: format (CSV, PDF through the print dialog, Excel when `actions.exportFile` is provided), records (all in the view or the selection), columns (visible in order or all), values (as displayed — currency, dates, option labels — or raw) and the file name (table, saved view and day by default). With `actions.exportFile(request)` the server builds the file from the view's query (`list` shape), the chosen columns and options, and returns a download link or a Blob; otherwise the browser writes the CSV (UTF-8 with BOM) or prints a paginated table. `table.exportFormats` limits the formats offered; `onExport` still replaces the CSV file. File names drop accents.
