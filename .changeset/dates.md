---
"yayaw-table-workspace": minor
---

Date and time columns: set `withTime: true` on a `date` column (or a form field) to hold ISO 8601 instants. Cells show the date and time in the locale (the `dateTime` preset unless the column sets its own), forms and inline edits use a date and time input in the column's `timeZone` and save the instant in UTC, sorting compares instants, filters compare the instant's day in that zone, and exports keep the time.

Relative date filters: a date rule's value can be `$today`, `$yesterday`, `$tomorrow`, `$thisWeek`, `$lastWeek`, `$nextWeek`, `$thisMonth`, `$lastMonth`, `$nextMonth`, `$thisYear`, `$lastNDays` or `$nextNDays` (for example `{ "columnId": "due", "operator": "between", "values": "$thisWeek" }`), with "before today" and "after today" through `before` / `after` and `$today`. The filter menus offer them by name, saved views, links and `table.defaultFilters` keep them as tokens, and the table resolves them to days in `table.timeZone` before calling `list`, `aggregate` or facet counts. Weeks start on the new `table.weekStartsOn` (0 to 6), else on the locale's first day. Servers that run saved queries later can call `resolveFilterTokens()`.

Viewer filter: a rule whose value is `$viewer` matches the new `table.viewerId` set by the host (for example "assigned to me"); without it, `$viewer` reaches the server unchanged for it to replace with the signed-in user.
