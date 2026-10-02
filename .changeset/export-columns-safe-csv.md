---
"yayaw-table-workspace": minor
---

Export improvements, in React and Vue alike.

- **`enableExport: false` (column)** keeps a column in the table: it never appears in the Export screen's Visible, All and "Choose columns" lists, the `actions.exportFile` request, the bulk CSV, the `columns` a Connect destination receives, or the connector screen's Visible and All mapping lists. It used to be ignored.
- **Choose columns**: the Export screen's Columns setting offers a third choice, a checklist of the exportable columns in display order, checked for the visible ones, with "Select all" and "Select none". The CSV, the printed PDF and the `exportFile` request write exactly the checked columns in that order (`ExportSettings.columns: "custom"` with `columnIds`). Export stays disabled, with an announced hint, while no column is checked.
- **French labels**: every Export screen label (`exportScreen.*`, now with `columnsCustom`, `columnsChoice`, `columnsSelectAll`, `columnsSelectNone`, `columnsEmpty`, `records`, `recordsOne`, `yes`, `no`) has a built-in French version (`exportLabels`), and the PDF subtitle counts records with the locale's plural rule ("1 record", "0 enregistrement", "12 enregistrements"). Host translations keep overriding them.
- **Yes and No**: as displayed (and in the PDF), boolean columns read "Yes"/"No" ("Oui"/"Non"), overridable with `exportScreen.yes` and `exportScreen.no`; a boolean column with `options` keeps their labels, and Raw keeps `true`/`false`.
- **Safe CSV**: both browser CSV writers (the Export screen and the bulk CSV) put an apostrophe before text starting with `=`, `+`, `-`, `@`, a tab or a carriage return, so spreadsheets do not run it as a formula. Numbers are left alone: number values, numeric text in `number` columns and their displayed text ("-12", "1 234,5"). The Vue bulk CSV now starts with the UTF-8 BOM, as the other writers do.
- **`table.exportCsvSeparator`** (`","` by default, `";"` for French Excel, or `"\t"`) separates the cells of both browser CSV writers.
- **The default file name includes the active saved view** in both editions (`projects-active-items-2026-10-02`), as `defaultExportFileName` documented.

**Migration.** None required. Exported text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return now begins with an apostrophe; hosts parsing the browser CSV should expect it.
