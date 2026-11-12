---
"yayaw-table-workspace": minor
---

Tables show their display modes as a segmented control beside the filter
chips (two modes or more; `table.displayModeSwitch: false` hides it), and
`table.createLabel` names the create button, which stays labelled among icon
actions. `viewRequest` asks a mounted table to show a view.

Dashboards: edit mode opens with a banner ("Draft", add a widget or a
section, save) that also offers the host's `onHistory`, `onResetToDefault`
and `onPublish`; section bars read "Section n · layout". Opt-in:
`periodInHeader` puts the screen's period beside "Refresh all", and
`kpiLinks` makes a filtered number toggle its records in the source's
full-page table.

Theme: the table, dashboard, calendar, chart and map components read the
theme's tokens for every state colour. Statuses no token names read
`--yayaw-success`, `--yayaw-warning`, `--yayaw-highlight` and `--yayaw-file-*`
(each with a fallback). React and Vue behave the same.
