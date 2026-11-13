---
"yayaw-table-workspace": patch
---

Dashboards (`kpiLinks`): a click on the pressed number returns the full-page
table to its widget's own view (its inline `view`, or the saved view it
names) instead of clearing every filter: that view's filters after a number's
filters, the whole view after a number's saved view. A table widget without a
view of its own still shows no filter. `dashboardKpiLinkRequest` takes the
view to return to as an optional third argument, given by the new
`dashboardKpiLinkBase`. React and Vue behave the same.
