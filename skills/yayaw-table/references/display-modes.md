# Display modes

The registry of modes is `display-modes.ts` (React
`components/ui/yayaw-table/utils/display-modes.ts`, Vue
`components/ui/yayaw-table-vue/display-modes.ts`): each mode's table-only
controls, grouping depth, settings key and whether it needs a renderer or a
planning session.

## Rules shared by every mode

- `table.displayModes` lists what users can pick; `table.defaultDisplayMode`
  opens first. A mode that cannot render is withheld (a renderer mode without
  its renderer, a file tree without a parent column, a Gantt without a
  planning graph, a form without `create`), and a link or saved view asking
  for it falls back to the default, then the first offered mode, `table` last.
- Grouping depth: two levels in `table`; one in `list`, `kanban`, `gallery`
  and `feed`; none elsewhere. Density applies to `table` and `list`;
  footer calculations and column settings to `table` only.
- Settings: `table.<mode>` holds the table defaults; each saved view stores
  its own copy (`config.<mode>`) and the URL keeps the current one in
  `<tableId>-<mode>`; Reset view restores the saved copy.
- Every card, line, marker, post and bar opens its record the way a row click
  does (record view, edit form or link).
- Grids, lists, boards and galleries show the current page of `list`.
  Calendar, chart, map, file tree and derived Gantt load every row of their
  window through scopes or the capped loader (2,000 rows by default).
- `table.facets` puts a facet panel beside every mode but `form`: see
  [configuration](configuration.md#facets).
- `TableDisplayMode` grows with releases: exhaustive `Record<TableDisplayMode,
  …>` maps in host code need an entry per new mode.

## `table`

Sorting (several columns), column filters, advanced filters (AND/OR), search,
grouping, footer calculations (`enableCalculations`, answered by
`actions.aggregate`), inline editing, pinning, resizing, reordering, density,
automatic page size (`enableAutoPageSize`). Grouping works on the rows of the
current page: a server that paginates before grouping yields page-local
groups; use a chart for totals across all records.

## `list`

`table.list`: `titleColumn`, `cardColumnIds`, `showCardLabels`, `wrap`,
`showActions`, `propertyAlign` (`"end"` or `"start"`), `maxProperties`,
`mobileMaxProperties`. Lines are sectioned by the first grouping level.
Manual order: `table.manualOrder: true` plus `actions.reorder` add "Manual
order" to the sort menu; lines then drag (mouse, touch, pen) or move with
Alt+Arrow keys within their group, and `list` receives the sort
`[{ id: "__manual", desc: false }]` with `viewId` so the server applies that
view's own order. Records are never modified by a reorder.

## `kanban`

`table.kanban`: `groupBy` (a select or tag column; the view's grouping wins),
`titleColumn`, `cardColumnIds`, `showCardLabels`, `groups` (fixed lane order,
`{ value, label }[]`), `allowDragUpdate`. A move calls
`actions.update(id, { [groupBy]: value })` optimistically and rolls back on
failure; cards also move with the keyboard. `table.kanban.server` turns the
board into a remote, read-only board: `{ queryKey, groups(signal),
rows(group, cursor, signal), getRowId?, onActivate?, labels? }`, with global
lane counts and cursor paging per lane; change `queryKey` whenever the query
or the user's scope changes. Remote boards have no drag, selection or bulk
actions.

## `gallery`

`table.gallery`: `imageColumn`, `titleColumn`, `cardColumnIds`, `aspectRatio`
(`portrait`, `square`, `video`, `wide`), `imageFit` (`cover`, `contain`),
`cardSize`, `showCardLabels`, `previewSize` (`small`, `medium`, `large`) and
`media` (`{ enabled, urlColumn, typeColumn, mimeTypeColumn, posterColumn,
hoverPreview, getMedia }`) for the viewer (image, video, audio, PDF, files).
`renderMedia` and `renderProperties` are runtime callbacks, never saved in
views. Only HTTP(S), relative, blob and image data URLs are displayed.

## `filetree`

Built in, offered when `table.filetree.parentColumn` is set or a column is
named `parentId`, `parent_id`, `parent`, `folderId`, `folder_id` or `folder`.
Settings: `parentColumn`, `kindColumn` (`"folder"`/`"file"`), `nameColumn`,
`sizeColumn`, `updatedColumn`, `columns`, `showDetails`, `detailFields`,
`foldersFirst`, `sort`, `defaultExpandedDepth` (0 to 2), `rootLabel`,
`expanded`, `expandedAll`. Hooks in `table.filetree`: `isFolder`, `getIcon`,
`renderDetails`, `onDropFiles` (the host uploads), `canMove`,
`canCreateFolder`, `canRename`. Server first: answer the `children`,
`subtree` and `tree-matches` scopes and implement `actions.tree`; without
them the tree is built in the browser from at most 2,000 rows, orphans and
cycles going to "Unfiled". The table's other views (not `form` or `gantt`)
offer "New folder" in the toolbar (a name and a searchable parent folder,
through `tree.createFolder` or `create`) and filter the parent column with a
folder picker (`isAnyOf` folder ids, `isEmpty` for the root); a facet on the
parent column lists the folders. `table.filetree.newFolderAction: false` and
`folderFilter: false` turn them off. Specification:
[file tree](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/FILETREE.md).

## `calendar` (optional item)

`table.calendar`: `dateColumn` (first date column by default), `endColumn`
(inclusive), `titleColumn`, `colorColumn`, `layout` (month, week, list),
`weekStartsOn`, `showWeekends`, `allowDragUpdate`, `allowResize`,
`allowCreate`. The visible range is sent to `list` as
`scope: { kind: "dateRange", field, endField, from, to }`; moves write back
in the stored format (date-only stays date-only) through `actions.update`; a
click on a day opens the create form with the date filled in.

```tsx
import { calendarRenderer } from "@/components/ui/yayaw-table-calendar/calendar-renderer";
// <DataTable displayModeRenderers={{ calendar: calendarRenderer }} … />
```

```ts
import { calendarRenderer } from "@/components/ui/yayaw-table-vue/calendar/calendar-renderer";
// <YayawDataTable :display-mode-renderers="{ calendar: calendarRenderer }" … />
```

FullCalendar loads with the renderer import: import it only in pages that
offer the mode.

## `chart` (optional item)

`table.chart`: `type` (`bar`, `horizontalBar`, `line`, `area`, `combo`,
`donut`, `funnel`, `number`), `xColumn`, `bucket` (`day`, `week`, `month`,
`quarter`, `year`), `weekStartsOn`, `metric` (`count`, `sum`, `avg`, `min`,
`max`, `countDistinct`), `metricColumn`, `seriesColumn`, `stacked` (bars),
`stacking` (areas: `stacked`, `percent`, `none`), `curve` (`smooth`,
`linear`), `lineMetric` and `lineMetricColumn` (the line of a `combo`, whose
bars use `metric`), `stageOrder` (funnel stages as option values), `sort`,
`cumulative`, `hideEmpty`, `topN`, `showDataLabels`, `showLegend`, `colors`,
`fill` (take the height of the nearest CSS size container instead of 320px,
without title, table toggle or hint; dashboards set it).
A combo chart puts its line on a right axis when the two metrics' number
formats differ; a funnel shows each stage's value, share of the first stage
and conversion from the previous one.
Server first: `actions.aggregate` receives the query plus `groupBy`
(at most two levels), `metrics` (two for a combo chart: bars, then line),
`timeZone` and `weekStartsOn`, and answers
`{ groups: [{ keys, values }], truncated? }`; `aggregateChartRows()` is a
reference implementation. Without it (or when it answers only `results`, or
fewer values than metrics), the chart aggregates the rows of the query in the
browser. Clicking a group adds the rules the filter menus write for its
column (yes/no groups are select rules on `true`/`false`) to the view's
filters and opens the table (not possible when the view matches any rule with
OR). Imports: `@/components/ui/yayaw-table-chart/chart-renderer`
(React, shadcn `chart` on Recharts) or
`@/components/ui/yayaw-table-vue/chart/chart-renderer` (Vue, Unovis); both
load their library lazily. Colors: option `color`, tag hues or `--chart-1…5`.

## `feed`

Built in; `table.feed: false` turns it off. `table.feed`: `titleColumn`,
`authorColumn`, `dateColumn`, `dateDisplay` (`relative`, `absolute`),
`bodyColumn`, `mediaColumn` (each `null` for none), `propertyColumnIds`,
`showPropertyLabels`, `bodyLines` (0 for the full text), `density`
(`comfortable`, `compact`), `pageSize` (10), `infiniteScroll`, and the
runtime `renderBody(value, row)` (markdown or sanitized HTML; bodies are plain
text otherwise, never injected as HTML). Pages come from `list`; without a
sort of its own the feed asks for its date column, newest first.

## `map` (optional item)

Needs a `location` column. `table.map` holds view defaults
(`locationColumn`, `titleColumn`, `colorColumn`, `popupColumns`,
`showPopupLabels`, `cluster`, `initialView` `fit` or `saved` with `center`
and `zoom`, `searchOnMove`) and host options: `style` (an id of `styles`, a
style URL or object, or `{ light, dark }`), `styles`
(`{ id, label, light, dark?, attribution? }[]`), `attribution`, `maxRows`
(2,000) and `workerUrl`. No tiles or keys ship: without a style the map is
blank and says so. "Search this area" (or every move with `searchOnMove`)
sends `scope: { kind: "bbox", field, west, south, east, north }` to `list`.
MapLibre's worker comes from unpkg unless `workerUrl` points to a self-hosted
`maplibre-gl-worker.mjs`, which needs `maplibre-gl-shared.mjs` (both from
`node_modules/maplibre-gl/dist/`) in the same folder. Imports:
`@/components/ui/yayaw-table-map/map-renderer` (React, mapcn on MapLibre GL)
or `@/components/ui/yayaw-table-vue/map/map-renderer` (Vue); both load lazily.
`actions.geocode` powers address search in `location` editors.

## `form`

Built in; offered when the table has `actions.create` and `allowCreate` is not
false; `table.form: false` turns it off and `table.form: { … }` sets defaults.
"Edit form" above the form (and View settings → Form) opens the form builder.
See [forms](forms.md).

## `gantt`

Core, but opt-in: `table.planning` (`enabled: true`, `scopeId`, `sourceId`,
`scheduling`: `preview` by default, `manual` or `automatic`, and the
`allow*` edit flags) plus `table.gantt` (`titleColumn`, `startColumn`,
`endColumn`, optional `parentColumn`, `calendarColumn`, `height`, and the
view settings `zoom`, `weekStartsOn`, `showDependencies`, `anchorDate`).
Without `actions.planning`, the graph is derived from `list` and saved through
`update` (`createRowsPlanningAdapter()`): not transactional, no dependencies,
the whole source loaded. Supply `actions.planning` (`load`, `preview`,
`apply`) for atomic commits, dependencies and paging. Keep
`getTableActions` referentially stable: a new identity rebuilds the graph. See
[Gantt](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/GANTT.md) and
[planning adapters](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/PLANNING-ADAPTERS.md).

## Dashboards (optional item)

`YayawDashboard` shows sections of widgets: four-column grids (gridstack,
loaded with the first desktop grid; phones stack widgets) and full-width
flows. A widget is a view of any source (a saved view, or inline settings) in
its display mode, a number over a view, a note, a full-page table (the
source's list page, flows only) or a host block. Admin screens are the same
component: a document the host gives (`dashboard`), sources loaded on demand
(`sources`), the host's `blocks`.

```tsx
import { YayawDashboard } from "@/components/ui/yayaw-table-dashboard/yayaw-dashboard";
// <YayawDashboard actions={{ dashboards }} tables={tables} canEdit openView={…} renderMarkdown={…} />
```

```ts
import YayawDashboard from "@/components/ui/yayaw-table-vue/dashboard/YayawDashboard.vue";
```

- `tables`: `Record<tableId, { config, actions, views?, name?, tableProps?,
  renderTable? }>`, sources given up front; `sources`: the lazy catalogue
  (`list`, and `load(id)` answering a source or `{ unavailable: true, reason,
  message? }`), of which only the sources the screen's widgets read load
  (`tables` win); `blocks`: `Record<key, { label?, placement?, defaultSize?,
  defaultProps?, propsSchema?, validateProps?, component, settings? }>`;
  `dashboard`: a document to show instead of `actions.dashboards.load`
  (`actions` is then optional; editing needs `save`); `dashboardId` (else the
  first one `list` returns); `canEdit` (false by default); `showTitle` (true);
  `unavailableWidgets` (`"show"`, or `"hide"`); `syncUrl` (true);
  `openView(tableId, viewId, context?)` (`context.view` for inline views);
  `displayModeRenderers` for widgets using optional modes;
  `renderMarkdown(text)` (sanitize any HTML); `locale` (every widget follows
  it); `translations` as `dashboard.<key>`; `tableTranslations`, the page's
  table labels passed to every widget (React needs them for a French page;
  Vue has French built in); `onChange` (Vue `change`).
- Unavailable sources (forbidden, not configured, not found) show a muted
  notice, blocks the host lacks "Unavailable block"; both stay in the document
  and in edit mode. `unavailableWidgets: "hide"` leaves them out of the view,
  grids closing the gaps (display only).
- Full-page `table` widgets render the source's `DataTable` /
  `YayawDataTable` with toolbar, saved views, selection and URL sync, no card;
  host code comes from `tableProps`, `renderTable(props)` wraps it. Their
  inline view is a system default view `screen:<dashboardId>:<widgetId>`
  (`isDashboardViewId()`), after the reader's favorite. The screen's first
  table keeps the table's URL keys, others use `instanceId = widget.id`.
- Blocks receive these props; a throwing block stays in its widget; a block
  rendering nothing collapses in a flow:

<!-- skill-check: props -->
| Prop | Is |
| --- | --- |
| `props.widgetId`, `props.props`, `props.size` | The widget's id, its props over the block's `defaultProps`, its grid size (none in a flow) |
| `props.editing`, `props.locale`, `props.revision` | Edit mode, the screen's language, a number that changes when widgets should load again |
| `props.filters` | The screen's filter values by filter id (date ranges resolved to days) |
| `props.refresh` | `(tableId?)`: reloads a source's widgets, or all of them |
| `props.setFilter` | `(filterId, value)`: sets a filter as the filter bar does (URL for readers, the default in edit mode); answers `{ ok: true, value }`, or `{ ok: false, code: "unknownFilter" \| "invalidValue", message }` and changes nothing |
| `props.filterRules` | `(tableId, { exclude? })`: the rules the screen's filters give a source, for the block's own requests (`withDashboardFilters(actions, rules)`) |
| `props.openView` | The host's `openView`, when given |

- `createFacetBlock({ filterId, tableId, column, actions?, label?, layout? })`
  (React `yayaw-table-dashboard/dashboard-facet-block.tsx`, Vue
  `dashboard/dashboard-facet-block.ts`) is a ready "Facet list" block: a
  column's values with their numbers of records under the screen's other
  filters (`aggregate`, else `list`), whose clicks set a `select` filter
  through `setFilter` ("All" clears it). Props: `{ filterId?, layout?:
  "chips" | "list", showCounts? }`.
- Filter values readers pick stay in the URL (`<dashboardId>.<filterId>`),
  never in the document (its `value` is the default); date ranges offer the
  last 7, 30 and 90 days, this month, last month and this year, stored as
  `{ preset }` and sent as days.
- "Refresh all" reloads every widget; changes made in a full-page table
  (`withMutationSignal()`) reload the other widgets of its source.
- Phones stack widgets: numbers and notes at their content's height, charts
  at a 16:10 body, record widgets at their rows' height.
- Storage: `actions.dashboards` (`list`, `load`, `save`, `remove`), see
  [server contracts](server-contracts.md#dashboards). The JSON is version 2,
  `{ version: 2, id, name, description?, sections, widgets, filters }`:
  sections are `{ id, type: "grid", title?, layout }` or `{ id, type:
  "flow", title?, widgetIds }`; widgets `{ id, type: "view" | "kpi" | "note"
  | "table" | "block", title?, tableId?, viewId?, view?, block?, props?,
  settings }` (`table` in flows only). Versions 0 and 1 migrate on load (one
  grid section `main`), "Done" saves version 2, newer versions are refused.
- Names, titles and filter labels are a text or `{ en, fr }` (as forms);
  `locale` picks the version shown. An inline `view` (a saved view's
  `config`) replaces `viewId`; "Open full view" then calls
  `openView(tableId, null)`.
- Flow sections stack widgets at full width and their natural height:
  record views keep their pagination, charts take a 16:10 body. In edit mode
  flow widgets move up and down; grid cards drag and resize.
- Edit mode (`canEdit` and `actions.dashboards.save`) is the screen editor,
  loaded in a chunk of its own: "Add section" (a grid of cards or full
  width), section bars (title, move, "Add widget here", remove), "Move to
  section" in widget menus, and one widget dialog to add or edit (what; a
  source from `sources.list()`, searched, unavailable ones disabled with
  their reason; settings). A block's props use its `settings` component
  (props over `defaultProps`) or JSON checked by `checkDashboardBlockProps()`.
  "Edit view…" edits a widget's view in the source's live table (no URL,
  saved views, selection or writes) and stores its last report in
  `widget.view`, without the page size unless it changed. "Use a copy of
  this view" inlines a saved view; "Make the current view the screen default"
  stores a full-page table's current view. "Done" runs `validateDashboard()`
  and lists the errors instead of saving. The rules are pure, in
  `dashboard-editor-model.ts` (server-safe).
- Dashboard filters (date range, select) target table columns. Each widget's
  `list` and `aggregate` receive the rules merged into the view's filters and,
  alone, as `requiredFilters`: the server must AND them with everything else,
  including a view that matches any rule with OR.
- Each view or number widget is its own table instance (`instanceId`,
  `initialView`, URL sync off, no toolbar, no row selection): only full-page
  tables and the readers' filter values write to the page URL.
- Nothing scrolls inside a widget by default. A view widget's
  `settings.overflow` is `"fit"` (default: tables, lists, galleries, boards
  and feeds drop their pagination, show the records that fit and "+N more ·
  View all", which calls `openView`) or `"scroll"` (the widget scrolls and
  keeps the view's pagination). Fitting hides the elements marked
  `data-row-id` (lanes `data-kanban-lane`) that overflow; a custom renderer
  used in a fit widget should mark its records the same way. "+N more" reads
  `meta.totalCount` from `list`.
- Charts in widgets fill them: dashboards set the chart setting `fill: true`
  (legend placement, data labels and axes follow the room).
- Numbers (`type: "kpi"`) take `settings: { metric, metricColumn?, label?,
  dateColumn?, compare?: { period: "previous", days?: 30, better?: "up" |
  "down" }, sparkline?: { bucket?: "month", buckets?: 6 } }`. `compare` and
  `sparkline` need `dateColumn`; the dashboard's date range on that column
  sets the current period, else the last `days` days.
- New widgets take a size by type and display mode (numbers 1×1, notes 1×2,
  tables, lists, charts and maps 2×2, boards, galleries, calendars, feeds and
  forms 2×3).

## Custom renderers

`displayModeRenderers` maps a mode id to a renderer: React
`{ View, Settings? }` components receiving `{ context }`, Vue
`{ view, settings? }` components receiving a `context` prop. A host renderer
replaces the built-in view of that mode (documented for `form`, `feed` and
`filetree`); new mode ids need a change to the library's registry. The context
(`DisplayModeRenderContext`) gives `listParams`, `list`, `aggregate`, `rows`,
`advancedFilters`, `groupBy`, `showRecords(rules)`, `getRowId`,
`canEditRow`, `canCreate`, `updateRow`, `patchRow`, `deleteRow`,
`canDeleteRow`, `openRow`, `createRow`, `createRecord`, `viewId`,
`formLinks`, `tree`, `media`, `imageColumn`, `selection`, `coloredTags`,
`revision` (changes when the page data changes, e.g. after a mutation: reload;
it and `rows` stay the same across renders and column-order changes),
`emptyState`, `title`,
`syncUrl` and `refresh`, plus the settings context (`tableId`, `locale`,
`columns`, `defaults`, `settings`, `updateSettings`, `translate` and
`formFields`, the create form's fields when `getFormConfig` declares them). Use
`loadScopedRows()` to load every row of a window with a scope.
