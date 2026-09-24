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
cycles going to "Unfiled". Specification:
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

`table.chart`: `type` (`bar`, `horizontalBar`, `line`, `donut`, `number`),
`xColumn`, `bucket` (`day`, `week`, `month`, `quarter`, `year`),
`weekStartsOn`, `metric` (`count`, `sum`, `avg`, `min`, `max`,
`countDistinct`), `metricColumn`, `seriesColumn`, `stacked`, `sort`,
`cumulative`, `hideEmpty`, `topN`, `showDataLabels`, `showLegend`, `colors`.
Server first: `actions.aggregate` receives the query plus `groupBy`
(at most two levels), `metrics`, `timeZone` and `weekStartsOn`, and answers
`{ groups: [{ keys, values }], truncated? }`; `aggregateChartRows()` is a
reference implementation. Without it (or when it answers only `results`), the
chart aggregates the rows of the query in the browser. Clicking a group adds
its rules to the view's filters and opens the table (not possible when the
view matches any rule with OR). Imports: `@/components/ui/yayaw-table-chart/chart-renderer`
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

`YayawDashboard` shows widgets on a four-column grid (gridstack, loaded with
the first desktop grid; phones stack widgets): a saved view of any table in
its display mode, a number over a view, or a note.

```tsx
import { YayawDashboard } from "@/components/ui/yayaw-table-dashboard/yayaw-dashboard";
// <YayawDashboard actions={{ dashboards }} tables={tables} canEdit openView={…} renderMarkdown={…} />
```

```ts
import YayawDashboard from "@/components/ui/yayaw-table-vue/dashboard/YayawDashboard.vue";
```

- `tables`: `Record<tableId, { config, actions, views?, name? }>`, the tables
  widgets may show; `displayModeRenderers` for widgets using optional modes;
  `dashboardId` (else the first one `list` returns); `canEdit` (false by
  default); `openView(tableId, viewId)`; `renderMarkdown(text)` (sanitize any
  HTML); `translations` as `dashboard.<key>`; `onChange` (Vue `change`).
- Storage: `actions.dashboards` (`list`, `load`, `save`, `remove`), see
  [server contracts](server-contracts.md#dashboards). The JSON is
  `{ version: 1, id, name, layout, widgets, filters }`; the model repairs
  layouts, migrates older JSON and refuses newer versions.
- Dashboard filters (date range, select) target table columns. Each widget's
  `list` and `aggregate` receive the rules merged into the view's filters and,
  alone, as `requiredFilters`: the server must AND them with everything else,
  including a view that matches any rule with OR.
- Each widget is its own table instance (`instanceId`, `initialView`, URL
  sync off), so a dashboard never writes to the page URL.

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
`revision` (changes after each mutation: reload), `emptyState`, `title`,
`syncUrl` and `refresh`, plus the settings context (`tableId`, `locale`,
`columns`, `defaults`, `settings`, `updateSettings`, `translate` and
`formFields`, the create form's fields when `getFormConfig` declares them). Use
`loadScopedRows()` to load every row of a window with a scope.
