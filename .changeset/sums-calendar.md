---
"yayaw-table-workspace": minor
---

Calendar events can end after a duration instead of an end column: the calendar view settings accept `durationColumn` (a number in `durationUnit`, `"minutes"` by default, `"hours"` or `"days"`, or an ISO 8601 duration such as `"PT1H30M"`) and `defaultDuration`. Moving an event keeps its duration; stretching it writes the duration back, never an end.

Amounts in several currencies are no longer summed together: `numberFormat.currencyColumn` names the field holding each row's currency, cells read in their row's currency, and footer calculations (and React group subtotals) show one total per currency, such as "€1,200.00 · $300.00". `numberFormat.currencyConversion` (`{ currency, rates, convert?, display? }`) shows a single converted total, and `actions.aggregate` receives `currencyColumns` and may answer `byCurrency` amounts.
