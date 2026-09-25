# Configuration

Types: React `components/ui/yayaw-table/config/helpers.ts` (with the defaults
in `components/ui/yayaw-table/config/defaults.ts`), Vue
`components/ui/yayaw-table-vue/types.ts` and `components/ui/yayaw-table-vue/config.ts`.

## Shape

```ts
const config = defineTableConfig({
  id: "projects",                       // catalogue id; tableType usually matches it
  columns: {
    definitions: [/* ColumnDefinition */],
    order: ["select", "name", "status", "actions"], // select/actions are the utility columns
    visible: ["name", "status"],        // the rest start hidden
    mandatory: ["name"],                // cannot be hidden
    sort: [{ id: "name", desc: false }], // the sort the table starts from and resets to
  },
  table: { /* flags, displayModes, one object per mode (table.kanban, table.chart…) */ },
  translations: { namespace: "projects", keys: { title: "Projects", description: "…" } },
  form: { createFormType: "project", editFormType: "project" }, // catalogue forms, see forms.md
  presentation: { desktop: "drawer", mobile: "drawer" },          // record view, create, edit, bulk edit
  toolbarActions: [/* { id, label, icon?, onClick(context) } */],
});
```

`defineTableConfig()` merges `table` over the defaults and the optional
`table.layoutPreset` (`"admin"`, `"catalog"`, `"preview"`: page sizes, density,
icon actions). A table is rendered by `tableType`; `tableId` (default: the
`tableType`) names the instance in URL keys, caches, selection and saved
views, so two tables of the same type on one page need different `tableId`s
or an `instanceId`.

## Columns

| Field | Purpose |
| --- | --- |
| `id`, `header`, `type` | Identity, label, type (below). Vue also takes `accessorKey` or `accessorFn`. |
| `options` | `{ value, label, color? }[]` for select, tag and multi-select columns; values keep their primitive type. |
| `displayVariant: "tag"`, `coloredTags`, `tagColorMap` | Tags instead of plain text; colors come from the stored value or `color`. |
| `numberFormat`, `dateDisplayPreset`, `dateFormat`, `timeZone`, `hour12` | Formats, see below. |
| `inlineEdit` | `true` or `{ enabled, editor, debounceMs, options, readonly }`; editing is opt-in per column or with `table.inlineEdit.enabled`. |
| `enableSorting`, `enableFiltering`, `enableGrouping`, `enablePinning`, `enableResizing`, `enableCalculation`, `defaultCalculation` | Per-column capabilities and the default footer calculation. |
| `size`, `minSize`, `maxSize` | Widths in pixels. |
| `cellRenderer(value, row)` | Custom cell (React node, Vue VNode). |
| `filterRenderer({ value, onChange })` | Custom control inside the column filter menu; writes the normal filter state. |
| `urlDisplayMode` | `icon`, `domain`, `full` or `row-link` (the row opens the link). |
| `typeKey` | With `type: "dynamicType"`, the row field holding each row's type. |

Column types drive the generated form field, the inline editor and the filter
family (`TABLE_DATA_TYPES` in `table-contracts.ts`):

<!-- skill-check: column-types -->
| Type | Form field / inline editor | Filter family |
| --- | --- | --- |
| `text`, `string` | text / text | text |
| `code` | textarea / textarea | text |
| `number` | number / number | number |
| `boolean` | switch / boolean toggle | select (true, false) |
| `date` | date picker / date (`YYYY-MM-DD` writes) | date |
| `url`, `image` | url / url | text |
| `json` | JSON editor / JSON | text |
| `select`, `tag` | select / select | select |
| `multiSelect` | multi-select / multi-select | multi-select |
| `location` | place editor (address search with `actions.geocode`) / place | location (`withinDistance`, `withinBounds`) |
| `dynamicType` | resolved per row from `typeKey` | text |
| `custom` | needs a catalogue form field | text or `filterRenderer` |
| `actions` | none (row actions column) | none |

`location` values are `{ lat, lng, label?, address? }`; the table also reads
`latitude`/`longitude`, `lon`, GeoJSON points and "lat, lng" text.

## Value formats

A format is a column setting and applies everywhere the value is shown: table
cells and footer totals, group headings, list, Kanban and gallery cards and
lanes, record details, the Form view, feed posts, calendar and Gantt titles,
map titles and popups, chart axes, tooltips and legends, dashboard widgets and
filters, filter chips, the file tree, the import preview, connector previews
and formatted exports; imports read numbers back with the column's
separators. Values stay raw only in server requests, connector pushes and raw
exports. Shared code: `value-format.ts`.

- `numberFormat`: a preset (`"space"`, `"dot"`, `"comma"`, `"locale"`) or
  `{ style: "decimal" | "currency" | "percent" | "compact" | "unit", currency,
  currencyDisplay, unit, unitDisplay, decimals (Vue alias decimalPlaces),
  minimumFractionDigits, maximumFractionDigits, thousandsSeparator,
  decimalSeparator, prefix, suffix, signDisplay, negative: "parentheses",
  percentBase: "fraction" | "whole", display: "bar", max, locale }`.
- Dates: `dateDisplayPreset` (`localized-short` by default, `localized-medium`,
  `localized-long`, `month-name-long`, `month-year`, `dmy-numeric`, `dmy-short`,
  `mdy-numeric`, `mdy-short`, `iso-date`, `iso`, `date`, `short`, `long`,
  `dateTime`, `time`, `relative`), or a date-fns `dateFormat` pattern.
  `table.dateDisplayPreset` sets the table default. One rule in both
  editions: the column's pattern, else its preset, else the table's preset.
- `timeZone` (IANA) applies to presets and patterns, `hour12` to presets (a
  pattern picks `HH` or `h`); an unknown zone shows local time. Charts bucket
  dates in the x column's `timeZone`.
- Days (chart day and week buckets, date filters, Form answers) show the
  date part of the column's format. Totals (sum, average, min, max…) use the
  column's format; counts and percentages are plain localized numbers.
- `prefix`, `suffix` and separators keep their spaces (`" kg"`).
- Date-only strings (`2026-09-10`) are local calendar days in both editions;
  store and return them as such. Timestamps are instants.
- Without `numberFormat`, React shows the raw number (`1234.5`) and Vue a
  locale-grouped one (`1,234.5`): set `numberFormat` for identical output.
- Send raw values from the server. Pre-formatted strings break sorting,
  filters, aggregation, raw exports and imports.

## Table flags

Defaults in brackets. Flags only shape the interface; the server decides.

- Records: `allowCreate`, `allowEdit`, `allowDuplicate`, `allowDelete`,
  `allowBulkEdit`, `allowBulkDelete` [true], `allowInlineEdit` [true, editing
  still opt-in], `canEditRow`, `canDeleteRow`, `canDuplicateRow`,
  `canSelectRow` (row guards), `rowClickMode` [`"default"`: edit form with
  `enableRowClickEdit`, a row-link column, else the record view; also
  `"activate"`, `"edit"`, `"link"`, `"none"`].
- Toolbar and data: `showToolbar`, `showToolbarHeader` [true],
  `actionsAsIcons` [false], `showClearFilters` [false; alias
  `showResetFilters`], `filterBarColumns` and `showFilterBar` [false],
  `export`, `bulkExport` [true], `exportFormats`, `import`, `share`,
  `connectors`, `sync`, `schedule` [true], `emptyState` (`title`,
  `description`, `show`).
- Query: `enableSorting`, `enableColumnFilters`, `enableGrouping` [true],
  `enableAdvancedFilters` [false], `searchDebounceMs` [300], `manualOrder`
  (with `actions.reorder`), `preserveSelectionOnQuery` [false].
- Layout: `density` [`"medium"`; `extra-small`, `small`, `large`,
  `extra-large`, `extra-extra-large`], `defaultPageSize` [10],
  `pageSizeOptions` [10…500], `enablePagination` [true],
  `enableAutoPageSize`, `defaultAutoPageSize` [false], `enableColumnDnd`
  [true], `enableColumnDragDropByDefault` [false], `enableColumnResizing`
  [false], `enableColumnPinning` [true], `enableCalculations` [false],
  `coloredTags` [true], `presentation` (on the config, not `table`).
- Selection: `enableRowSelection`, `enableMultiRowSelection` [true]; pass
  `getRowId` with stable record ids for server pagination.
- Views and URL: `enableViews` [true], `allowViewSave` [true],
  `allowViewSharing` [false], `viewTabs` [on, `{ maxVisible: 4 }`], `syncUrl`
  [true].
- Modes: `displayModes` [`["table"]`], `defaultDisplayMode`, and `kanban`,
  `gallery`, `list`, `filetree`, `calendar`, `chart`, `feed`, `map`, `form`,
  `gantt`, `planning` objects: see [display modes](display-modes.md).

## Translations

- `translations.keys.title` and `description` name the table (default
  description: "Manage your …").
- React: the `translations` prop replaces the whole dictionary and a missing
  key shows the key itself. Spread `defaultTranslations` (exported by
  `components/ui/yayaw-table/providers/table-provider.tsx`) and override; its
  built-in strings are English.
- Vue: `locale` (`"fr…"` selects French) and `translations` merge over the
  built-in English and French strings.
- Feature screens (chart, map, form, file tree, feed, import, connectors,
  schedules, dashboards, Gantt) carry English and French labels and read
  overrides as `<feature>.<key>` (`chart.loading`, `connector.send`,
  `views.gantt.today`…). A few keys differ between editions (React
  `views.calendar.*`, `views.tabs`; Vue `calendar.*`, `viewTabs`): copy key
  names from the edition's translations file.

## URL state

With `syncUrl` on, the state is in the query string, so links reproduce a
view. Keys use the prefix `<tableId>` (or `<instanceId>`):
`-q`, `-filters`, `-advancedFilters`, `-sort`, `-page` (**zero-based**, while
`list` receives `page` from 1), `-pageSize`, `-visibility`, `-order`,
`-sizing`, `-pinning`, `-grouping`, `-display`, `-kanban`, `-kanbanGroupBy`,
`-gallery`, `-gantt`, one per generic mode (`-list`, `-filetree`, `-calendar`,
`-chart`, `-feed`, `-map`, `-form`) and, in React, `-expanded`. The active saved
view is `view` (React also writes `historyIndex`); the file tree adds
`<tableId>-folder`. Density is not a URL key.

- Precedence on arrival: explicit URL state, then `initialActiveViewId`, the
  personal favorite, the first `isDefault` view, then the configuration. A
  link with only `?view=<id>` opens that saved view with its settings. A view
  named by the link or by `initialActiveViewId` does not wait for
  `getFavorite`; the URL is read once on mount, so the table's own first
  writes (its column order) never cancel it. The
  starting sort is the URL's, then the view's, then `columns.sort`; with none,
  no sort is sent and the order `list` returns is kept.
- Nested tables (the `tablePicker` form field) keep their state out of the
  URL unless `syncUrl: true`.
- Turn URL sync off (`table.syncUrl: false`; Vue also has a `syncUrl` prop)
  for embedded or secondary tables.

## Several tables on one page

- `instanceId` scopes an instance's URL keys (`<instanceId>-view`,
  `<instanceId>-…`); in React the instance also gets its own state store.
  Configuration, actions and saved views still come from the table type.
- `initialView: { id?, config }` starts an instance whose URL sync is off from
  a saved view, before its first request (dashboard widgets use it). It is
  ignored when URL sync is on; use `initialActiveViewId` there.
- React instances share the app's `QueryClient`, keyed by `tableId`; Vue
  instances create their own client unless you pass `queryClient`.
- The current view: React `onViewConfigChange(config)`, Vue
  `@view-config-change` (and the component's exposed `getViewConfig`), and
  `getViewConfig` in the toolbar actions' context. The config is saved-view
  settings (`canonicalViewConfig()`: sanitized, without the `select` and
  `actions` columns, keys in one order), reported on start and after each
  change, never twice for an equal view (dashboards' view editor reads it).

## Saved views

- `table.enableViews`, `allowViewSave`, `allowViewSharing` (`isGlobal`),
  `viewTabs`; `initialViews` (shown before `actions.views.list` answers) and
  `initialActiveViewId` props.
- A view saves `displayMode`, `density`, `globalSearch`, `columnFilters`,
  `advancedFilters` (with their AND/OR join), `sorting`, `grouping`,
  `columnVisibility`, `columnOrder`, `columnSizing`, `columnPinning`,
  `pageSize`, `footerCalculationsVisible` and each mode's settings (`kanban`,
  `gallery`, `gantt`, `list`, `filetree`, `calendar`, `chart`, `feed`, `map`,
  `form`). Selection, the current page and runtime callbacks are not saved.
  Vue's older `search`, `filters` and `pinning` names are still read.
- `isSystem` views cannot be changed; `canEdit` and `canDelete` are the
  host's per-view permissions for the interface; one personal favorite per
  table opens on arrival.
- Each user orders their views: the view menu's "Move left" and "Move right"
  ("Move up" and "Move down" where it lists the views: phones, `viewTabs:
  false`) move the current view, announced to screen readers. The order
  applies to the tabs, the "…" (More views) list and the menu; system views
  and the `isDefault` view stay first and new views come last. It is kept by
  `actions.views.setOrder` and `list`'s `order`, else in `localStorage`.
- Without `actions.views`, views, the favorite and the order live in
  `localStorage` (`createLocalTableViewActions()`, the order beside it), per
  browser and not per account.
  Persistence contract: [server contracts](server-contracts.md#saved-views);
  sharing rules: [saved views](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/SAVED-VIEWS.md).

## Records, selection and bulk actions

- Record view: on by default, fields derived from the columns; `details`
  (`RecordDetailsConfig`: sections, `activity`, `updatedAt`, labels) shapes it,
  `details={false}` removes it, `onOpenDetails(row)` opens your own route
  instead. Undo of an activity entry calls `onRevertActivity`. See
  [record details](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/RECORD-DETAILS.md).
- `presentation`: `"drawer"` (default), `"modal"`, `"inline"`, or
  `{ desktop, mobile? }` for view, create, edit and bulk edit.
- Bulk actions: `customBulkActions`, `onBulkEdit`, `onBulkDelete`,
  `onBulkCopy`, `onBulkExport` (callbacks win over the built-in behaviour),
  `rowActions` for extra row menu entries, `toolbarActions` for the toolbar.
- Keyboard: Shift-click ranges, Ctrl/Cmd+A (all matching rows, across pages),
  Ctrl/Cmd+D (duplicate), Ctrl/Cmd+Z (undo through record activity).

## React and Vue differences

Same names, defaults, serialized state and contracts; these differences are
framework-native or known:

| Topic | React | Vue |
| --- | --- | --- |
| Configuration | `getTableConfig(tableType)` | `config` or `getTableConfig` |
| Rows without `list` | none: write an in-memory `list` (`initialData` only hydrates) | `data` prop, filtered, sorted and paged locally |
| Providers | one `QueryClientProvider`, a nuqs adapter, a sonner `Toaster` | optional `queryClient`, a vue-sonner `Toaster` |
| Translations | replace: spread `defaultTranslations` | merged over English and French |
| Renderers | `{ View, Settings }` React components | `{ view, settings }` Vue components |
| Custom content | render props returning React nodes | render functions returning VNodes, plus slots (`#detail-<field-id>`, `form-<id>`, `#extra-fields`) |
| Icons | React nodes | Vue components |
| Events | callback props (`onRowActivate`, `onRowSelectionStateChange`, `onViewConfigChange`) | emits (`row-activate`, `row-selection-change`, `view-config-change`) |
| Bulk callbacks | receive TanStack `Row` objects | receive plain rows |
| Numbers without `numberFormat` | raw (`1234.5`) | locale-grouped (`1,234.5`) |
| Bulk Copy without `onBulkCopy` or `actions.bulkCopy` | JSON to the clipboard | hidden |
| URL | also `-expanded` and `historyIndex` | no `-expanded`, no `historyIndex` |
