---
"yayaw-table-workspace": minor
---

Add the optional Excel items, `yayaw-table-excel` (React) and `yayaw-table-vue-excel` (Vue): a dependency-free `.xlsx` writer, `writeXlsx`, for `table.excelWriter`. With it, the Export screen offers Excel without `actions.exportFile` and writes the file in the browser from the same cells as the CSV (as displayed or raw, the chosen columns): one worksheet named after the table, a bold header row, numbers as numeric cells, other values as text, in a store-only ZIP. `actions.exportFile`, when provided, still builds every format on the server.

```ts
import { writeXlsx } from "@/components/ui/yayaw-table-excel/xlsx-writer"; // Vue: @/components/ui/yayaw-table-vue/excel/xlsx-writer

table: { excelWriter: writeXlsx }
```
