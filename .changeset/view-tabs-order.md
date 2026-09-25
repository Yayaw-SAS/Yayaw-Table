---
"yayaw-table-workspace": minor
---

Each user orders their saved views, and the tabs' overflow is an icon, the same in React and Vue.

- **Move left, Move right**: the view menu moves the current saved view one step ("Move up" and "Move down" where the menu lists the views: phones, `viewTabs: false`). At an end an action stays focusable but inactive, so the focus stays on it, and each move is announced to screen readers ("View “Sales” moved to position 3 of 6"). The order applies to the tabs, the "…" list and the view menu. System views and the default view (`isDefault`, such as a dashboard screen's default) stay first; views the order does not name (new ones) come last.
- **Contract**: optional `actions.views.setOrder({ tableId, tableType, viewIds })` → `{ success, data: { viewIds } }`, with every view the user orders, first to last. `list` answers `order` (the ids `setOrder` last received) or lists the views in that order. Without `setOrder`, the order stays in localStorage under `yayaw-table-view-order:<JSON [tableType, tableId]>`, like the favorite.
- The rules are pure, in the new server-safe `utils/view-order.ts` (synced to Vue): `orderViews(views, order)` sorts views the table's way, also on a host's server. New types: `SetTableViewOrderInput`, `TableViewListResult` (`{ data, order? }`) and `LocalTableViewActions`.
- **"…" instead of "More ⌄"**: the overflow is an icon-only button (Lucide `Ellipsis`) named "More views" ("Plus de vues"), with the same tooltip, next to the chevron that opens the view menu. Its menu shows full view names.
- **Phones**: the Vue view menu's rows are 44px touch targets, as in React.
- **Translations**: `views.more` (Vue `moreViews`) is now "More views" / "Plus de vues", the button's name. New keys, English and French in Vue: React `views.moveLeft`, `views.moveRight`, `views.moveUp`, `views.moveDown`, `views.moved` (`{name}`, `{position}`, `{count}`), `views.orderError`; Vue `moveViewLeft`, `moveViewRight`, `moveViewUp`, `moveViewDown`, `viewMoved`, `viewOrderError`. React falls back to English when a host's translations lack them.

**Migration.** None required. Hosts that translate `views.more` (Vue `moreViews`) translate it as "More views": it now names an icon button. `createLocalTableViewActions()` returns `LocalTableViewActions` (without `setOrder`); code typing it `Required<TableViewActions>` uses the new type.
