---
"yayaw-table-workspace": patch
---

Footer calculations no longer load more than 10,000 matching rows in the browser when `actions.aggregate` cannot calculate them, in React and Vue: past that, the list fallback stops after its first page and the footers stay empty. `fetchAllContractRows` takes an optional `maxRows`, and `MAX_CALCULATION_ROWS` is exported from the table contracts.
