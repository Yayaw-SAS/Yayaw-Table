---
"yayaw-table-workspace": minor
---

Dashboards render admin screens, in React and Vue: sources loaded on demand, host blocks and full-page tables.

- **`sources`**: a lazy catalogue (`list`, `load`) read through `createDashboardSourceLoader`; `tables` stays and wins. Only the sources the screen's widgets read load. Widgets show "Loading…", an error with Retry, a muted notice for an unavailable source (the host's message, else its reason: forbidden, not configured, not found) or "Unavailable block" for a block key the host lacks; these widgets stay in the document and in edit mode, and are saved as they are. `unavailableWidgets: "hide"` leaves them out of the view, grids closing their gaps, for display only.
- **`blocks`**: the host's registry, `Record<key, DashboardBlock>`. `DashboardBlock` extends the pure `DashboardBlockSchema` (`label`, `description`, `group`, `placement`, `defaultSize`, `defaultProps`, `validateProps`, `propsSchema`) with `component` and an optional `settings` component. Blocks receive `{ widgetId, props, size?, editing, locale, revision, filters, refresh(tableId?), openView? }`; a failing block stays in its widget; a block rendering nothing collapses in a flow and stays an empty card in a grid.
- **Full-page `table` widgets** render the source's `DataTable` / `YayawDataTable` with its toolbar, saved views, selection and URL sync, without a card (an edit bar in edit mode). `DashboardTableSource` gains `tableProps` and `renderTable(props)` (host code, never stored). The widget's inline view is a system default view `screen:<dashboardId>:<widgetId>` (`isDashboardViewId`), after the reader's favorite; the screen's first table keeps the list page's URL keys, the others use their widget id; screen filters reach it as `requiredFilters`.
- **Refresh**: "Refresh all" reloads every widget (React invalidates full-page tables' queries; Vue's `YayawDataTable` now exposes `refresh()`); changes made in a full-page table (`withMutationSignal`) reload the other widgets of its source and the blocks.
- **New props**: `dashboard` (a document to show; `actions` is then optional), `showTitle`, `syncUrl`, and `openView(tableId, viewId, context?: { view })`.
- **Filters**: the values readers pick are view state, kept in the URL (`<dashboardId>.<filterId>`), never written to the document, whose `value` is the default; edit mode sets the defaults. Date ranges offer relative periods (last 7, 30 and 90 days, this month, last month, this year), stored as `{ preset }` and sent as days resolved in the reader's time zone.
- **`meta.notice`**: a `list` or `aggregate` answer carrying `meta.notice` (`{ code?, message? }`) shows a muted notice instead of empty data.
- Titles: `dashboardWidgetTitle` names full-page tables after their source and blocks after their label. Headings: the screen `h2`, sections `h3`, widgets `h3` or `h4`.
- Demo `?example=screen` ("Content admin") in both editions.

**Migration.** `DashboardBlockDefinition` (unreleased) is now `DashboardBlockSchema` (alias kept) and a block's `name` is its `label`. Filter values picked in view mode no longer change the document nor call `onChange`: they stay in the URL. The `dashboard.notAvailableYet` label is gone. See `docs/DASHBOARD-SCREENS.md`.
