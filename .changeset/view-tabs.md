---
"yayaw-table-workspace": minor
---

Saved views now show as tabs in React and Vue as soon as a table has one: the default view first, each tab with the icon of its layout and a dot when modified, extra views under "More" (the active view always stays visible) and a "+" that saves a new view with a chosen layout. The view menu trigger becomes a settings button next to the tabs; touch layouts keep the menu. Configure with `table.viewTabs` (`false` to keep the menu only, `{ maxVisible }`, default 4). The save dialog also offers the layout of the new view. New translation keys: `views.tabs`, `views.more`, `views.newView`, `views.dialog.save.layout` (Vue: `viewTabs`, `moreViews`, `newView`, `viewLayout`).

The calendar toolbar now uses the table toolbar's sizes (32px controls, small text) in both editions.
