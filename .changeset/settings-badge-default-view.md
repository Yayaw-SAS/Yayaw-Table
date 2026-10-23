---
"yayaw-table-workspace": patch
---

The view settings badge no longer counts the filters and sort of the default view, in React and Vue: a table showing its default view (`table.defaultView` over the catalogue's defaults) has no badge, and the badge counts only the filters and sorts added or changed over it. `viewSettingsBadgeCount` is exported from the table contracts.
