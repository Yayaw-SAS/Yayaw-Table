# Dashboard screens (JSON version 2)

A dashboard is a screen described by data: sections in order, the widgets
they place, and filters joined to the widgets' queries. Hosts store the JSON
(a database row, a file, a default written in code), render it with
`YayawDashboard` (React and Vue), and validate it on their servers with pure
modules that import no React, Vue or CSS. AI tools (MCP) prepare drafts with
the same grammar; people publish them.

Both editions ship the grammar and its tools, and a renderer for screens:

| Ships now | Comes next |
| --- | --- |
| The version 2 grammar, migration from versions 0 and 1 | The screen editor: sections, the widget wizard (what, source, settings) |
| `validateDashboard`, `checkDashboardReferences`, `dashboardJsonSchema` | Source and block pickers over `sources.list()` and `blocks` |
| `sanitizeViewConfig`, `dashboardFingerprint`, builders | The view editor (the real table as the editor, `onViewConfigChange`) |
| The `sources` catalogue, loaded on demand; unavailable sources kept | "Make the current view the screen's default" |
| Host `blocks`, full-page `table` widgets with their toolbar, saved views and URL | |
| Readers' filter values in the URL, relative date periods, `meta.notice` | |
| "Refresh all", reloads after changes, the `?example=screen` demo | |

## The document

```json
{
  "version": 2,
  "id": "cms",
  "name": { "en": "Content", "fr": "Contenu" },
  "description": "Pages and media at a glance",
  "sections": [
    {
      "id": "cards",
      "type": "grid",
      "title": { "en": "Today", "fr": "Aujourd'hui" },
      "layout": [{ "widgetId": "published", "x": 0, "y": 0, "w": 1, "h": 1 }]
    },
    { "id": "page", "type": "flow", "widgetIds": ["pages", "storage"] }
  ],
  "widgets": [
    {
      "id": "published",
      "type": "kpi",
      "tableId": "pages",
      "title": { "en": "Published", "fr": "Publiées" },
      "view": {
        "advancedFilters": [
          { "id": "p", "columnId": "status", "operator": "is", "values": ["published"], "isActive": true }
        ]
      },
      "settings": { "metric": "count" }
    },
    {
      "id": "pages",
      "type": "table",
      "tableId": "pages",
      "view": { "displayMode": "table", "sorting": [{ "id": "updatedAt", "desc": true }] },
      "settings": {}
    },
    { "id": "storage", "type": "block", "block": "media.storage", "props": { "unit": "GB" }, "settings": {} }
  ],
  "filters": []
}
```

| Key | Value |
| --- | --- |
| `version` | `2` (`DASHBOARD_VERSION`) |
| `id` | The host's id, 200 characters at most |
| `name`, `description` | Localized texts |
| `sections` | Sections in display order, 12 at most |
| `widgets` | Widgets, 50 at most; sections place them by id |
| `filters` | Dashboard filters, 12 at most |
| `updatedAt` | Optional timestamp, written by `YayawDashboard` on save; fingerprints ignore it |

**Sections.** A `grid` section is a 4-column grid of cards: `layout` places
each widget (`x` 0–3, `w` 1–4, `h` 1–12 rows of 120px). A `flow` section
stacks widgets at full width and the height of their content, in `widgetIds`
order. Both take an optional localized `title`.

**Widgets.** Every widget has an `id`, a `type`, an optional localized
`title` and `settings`:

| Type | Fields | Settings | Sections |
| --- | --- | --- | --- |
| `view` | `tableId`, `viewId` or `view` | `{ overflow?: "scroll" }` (fit by default) | grid, flow |
| `kpi` | `tableId`, `viewId` or `view` | `{ metric, metricColumn?, label?, dateColumn?, compare?, sparkline? }` | grid, flow |
| `note` | none | `{ text }` (20,000 characters at most, host markdown) | grid, flow |
| `table` | `tableId`, `viewId` or `view` | `{}` | flow only |
| `block` | `block` (the host block's key), `props` (JSON) | `{}` | where the block's `placement` says |

`viewId` names a saved view of the source; `view` holds inline settings, a
saved view's `config` without its identity (display mode and its settings,
filters, sorts, columns). With both, `view` wins. Without either, the widget
shows the source's default view.

**Filters.** `{ id, type: "dateRange" | "select", label, targets: [{ tableId,
columnId, widgetIds? }], options?, value? }`, as in version 1, with a
localized `label`. A target's `widgetIds` limit it to those widgets. `value`
is the default readers start from: days (`{ start?, end? }`), a relative
period (`{ preset: "last30Days" }`, see [Filters](#filters-readers-values-and-relative-periods))
or the chosen options.

**Localized texts.** Names, descriptions, section and widget titles and
filter labels are a string (every language) or one string per language
(`{ "en": "Sales", "fr": "Ventes" }`), exactly as form texts. `YayawDashboard`
shows the version of its `locale`, then of its language, then the first one.
Titles and labels are 120 characters at most per language, descriptions 500.

**Ids.** Widgets, sections and filters have ids of letters, digits, `-` and
`_`, starting with a letter or digit, 64 characters at most
(`DASHBOARD_ID_PATTERN`). Block keys may also hold `.` and `:`
(`home.summary`).

## Versions

`validateDashboard` reads versions 0, 1 and 2 and writes version 2:

- Version 1 (`layout` and `widgets`, no sections) becomes one grid section
  `main` holding its layout.
- Version 0 (no `version`) is version 1 with react-grid-layout items (`i`).
- A version above 2 is refused (`unsupportedVersion`): the document stays as
  it is and nothing renders.
- A widget type the document's version does not know is dropped
  (`invalidWidget`). **A new widget or section type bumps the version**, so an
  older reader refuses a newer document instead of losing its widgets.

Hosts upgrade every reader before writing version 2: the library 3.7 refuses
version 2 documents. `YayawDashboard` reads older documents, shows them and
saves them as version 2 on "Done".

## Validation

```ts
import {
  checkDashboardReferences,
  validateDashboard,
} from "@/components/ui/yayaw-table-dashboard/dashboard-schema";

const result = validateDashboard(input, { blocks });
// { dashboard?, issues: [{ code, message, severity, path? }], ok, migratedFrom? }
```

`validateDashboard(input, { limits?, blocks? })` never throws. It repairs what
it can and reports every issue with a JSON path into the input
(`widgets[2].view.sorting[0].id`). `ok` is true when there is a document and
no error: errors mean something the document asked for was lost, warnings
are repairs that keep its meaning. `normalizeDashboard(input)` is the lenient
reading the renderer uses: the repaired document whatever its issues, and an
error only when the input is not a dashboard or too new.

| Code | Severity | Meaning |
| --- | --- | --- |
| `invalidDashboard` | error | Not a dashboard (no object, no id, unreadable) |
| `unsupportedVersion` | error | A version above 2 |
| `invalidWidget` | error | A widget with an unknown type or without its source or block key; dropped |
| `duplicateWidget` | error | A second widget with the same id; dropped |
| `invalidSection` | error | A section that is not a grid or a flow; dropped, its widgets go elsewhere |
| `duplicateSection` | error | A second section with the same id; dropped, its widgets go elsewhere |
| `invalidFilter` | error | A filter, target or target widget that cannot apply; dropped |
| `invalidValue` | error | A value of the wrong type or out of its enum (in settings, inline views, texts); dropped |
| `truncated` | error | A list or text over its limit; cut |
| `tooLarge` | error | The document over 256 KB of JSON, or block props over 16 KB (props removed) |
| `invalidBlockProps` | error | Props that are not JSON (functions, prototype keys, too deep) or that the host's block rejected; `validateProps` may report warnings too |
| `invalidLayout` | warning | A layout outside the grid or overlapping, a reference to a missing or already placed widget; repaired |
| `orphanWidget` | warning | A widget no section places; added to the first section that takes it (created when needed) |
| `misplacedWidget` | warning | A widget in a section that cannot hold it (a `table` in a grid); moved to one that can (created when needed) |
| `invalidId` | warning | An id outside the pattern; slugified and made unique, and layouts, flows and filter targets follow |
| `unknownKey` | warning | A key the grammar does not know, at any level; removed |
| `conflictingView` | warning | Both `viewId` and `view`; `view` is kept |
| `unknownBlock` | warning | A block key the host's `blocks` does not list (only with `blocks`); kept, shown as unavailable |

Limits (`DASHBOARD_LIMITS`, each overridable through `limits`): 12 sections,
50 widgets, 12 filters, titles of 120 characters, descriptions of 500, notes
of 20,000, block props of 16,384 characters of JSON nested 8 deep, 50 rules
per list of an inline view (sorts, column filters, filter rules), 262,144
bytes per document. Issues stop at 200.

**Inline views** go through `sanitizeViewConfig(input, limits?)` (in the
table's `utils/view-config.ts`): unknown keys are removed at every level,
lists and texts capped (`VIEW_CONFIG_LIMITS`), each value type-checked before
its display mode's normalizer reads it, filter operators checked against
`VIEW_FILTER_OPERATORS`, and the historical Vue names (`search`, `filters`,
`pinning`, a Kanban `groupBy`) read as the canonical ones. Hostile JSON
(prototype keys, deep nesting, huge lists, throwing getters) never throws nor
reaches a prototype.

**Block props** are deep-copied as JSON: `__proto__`, `constructor` and
`prototype` keys, functions, non-finite numbers and values nested deeper than
8 are left out and reported. Then the block's `validateProps(props)` runs, if
the host gives one; it returns problems (texts or `{ message, path?,
severity? }`), nothing when the props are valid, and may throw.

```ts
const blocks: DashboardBlocks = {
  "media.storage": {
    label: { en: "Storage", fr: "Stockage" },
    placement: "grid",
    defaultSize: { w: 1, h: 2 },
    defaultProps: { unit: "GB" },
    propsSchema: { type: "object", properties: { unit: { enum: ["GB", "MB"] } } },
    validateProps: (props) =>
      props.unit === undefined || ["GB", "MB"].includes(String(props.unit))
        ? undefined
        : [{ message: "unit is GB or MB", path: "unit" }],
  },
};
```

## References

`checkDashboardReferences(dashboard, { sources, blocks? })` checks a
validated document against what the host offers this user, and returns `{
issues, ok }` with paths into the validated document:

| Code | Severity | Meaning |
| --- | --- | --- |
| `unknownSource` | error | A widget or filter target names a source the user cannot find |
| `unavailableSource` | warning | The source is listed but unavailable (`available: false`); its widgets show as unavailable |
| `unknownView` | error | `viewId` is not among the source's `views` |
| `unknownColumn` | error | A column of a sort, filter, visibility, width, order, pinning or grouping, a KPI's metric or date column, a display mode's `*Column`, `*Columns` or `*ColumnIds` setting, or a filter target |
| `unsupportedDisplayMode` | error | An inline view's display mode the source does not offer (`view` and `table` widgets) |
| `unknownBlock` | warning | A block key missing from `blocks` |

`sources` maps ids to summaries; a summary's `columns`, `views` and
`displayModes` are only checked when given.

## Sources

```ts
interface DashboardSourceSummary {
  id: string;
  name: DashboardText;
  description?: DashboardText;
  group?: DashboardText;
  keywords?: string[];
  columns?: { id: string; header?: DashboardText; type?: string }[];
  displayModes?: string[];
  views?: { id: string; name?: DashboardText; displayMode?: string }[];
  available?: boolean;
  unavailableReason?: "forbidden" | "notConfigured" | "notFound" | "error";
  unavailableMessage?: string;
}

interface DashboardSourceUnavailable {
  unavailable: true;
  reason?: "forbidden" | "notConfigured" | "notFound" | "error";
  message?: string;
}

interface DashboardSources<S> {
  list: () => Promise<readonly DashboardSourceSummary[]>;
  load: (id: string) => Promise<S | DashboardSourceUnavailable>;
}
```

`createDashboardSourceLoader({ sources?, tables?, summarize })`
(`dashboard-sources.ts`) loads sources for a screen: `tables` (sources given
up front) win over the catalogue's; concurrent loads of a source share one
request; ready and unavailable states are kept for good; a failed load stays
an error until `retry(id)`. `list()` gives the tables' summaries, then the
catalogue's others; `state(id)`, `summary(id)` and `subscribe(listener)`
follow each source. A source that is forbidden, not configured or not found
is unavailable: its widgets say so and are never removed from the document.

## AI tools (MCP)

`dashboardJsonSchema({ sourceIds?, blocks?, limits? })` is the JSON Schema of
a version 2 document for tool inputs. With `sourceIds`, widgets and filters
may only name those sources; with `blocks`, each block becomes a widget
variant carrying its `propsSchema`. Its enums are the grammar's constants
(widget, section and filter types, metrics, buckets, display modes, filter
operators, densities).

Guidance for hosts exposing screens to AI tools:

1. **Drafts only.** A tool saves a draft; publishing, discarding and going
   back to the default stay actions of a person in the interface. No tool
   writes the published document.
2. **Validate in layers, as the user.** Parse JSON safely, then
   `validateDashboard(input, { blocks })`, then the host's own rules for the
   screen (required blocks, allowed widget types), then
   `checkDashboardReferences` with the sources this user may see. Refuse the
   draft when `ok` is false and return the issues (codes, messages, paths) so
   the model can fix them; report warnings with the saved draft.
3. **Revalidate at publish time** with the publishing person's rights: never
   take authority from the draft's author.
4. **Offer what the user can use.** Build `sourceIds` from the sources this
   user may read, and `blocks` from the host's registry with their
   `propsSchema`.
5. **Keep unavailable widgets.** A widget whose source is unavailable to one
   person stays in the document for the others.
6. **Sanitize what renders.** Notes are the host's markdown: `renderMarkdown`
   must sanitize HTML. Block props are data; blocks must not execute them.
7. **Track defaults.** For a screen whose default lives in code, store
   `dashboardFingerprint(default)` with the copy a person customizes; a
   different fingerprint later means the default changed.

## Server usage

`dashboard-schema.ts`, `dashboard-sources.ts` (optional dashboard items) and
`utils/view-config.ts` (the table) import no React, Vue or CSS and no client
module; `tests/server-safe-modules.test.ts` walks their imports in both
editions. Vue hosts import the same functions from
`@/components/ui/yayaw-table-vue/dashboard/dashboard-schema`.

```ts
import {
  checkDashboardReferences,
  type DashboardBlocks,
  dashboardFingerprint,
  validateDashboard,
} from "@/components/ui/yayaw-table-dashboard/dashboard-schema";
import type { DashboardSourceSummary } from "@/components/ui/yayaw-table-dashboard/dashboard-sources";

export function checkDraft(
  input: unknown,
  context: {
    blocks: DashboardBlocks;
    sources: Record<string, DashboardSourceSummary>;
  }
) {
  const result = validateDashboard(input, { blocks: context.blocks });
  if (!(result.ok && result.dashboard)) {
    return { ok: false, issues: result.issues };
  }
  const references = checkDashboardReferences(result.dashboard, {
    sources: context.sources,
    blocks: context.blocks,
  });
  return {
    ok: references.ok,
    issues: [...result.issues, ...references.issues],
    document: result.dashboard,
    fingerprint: dashboardFingerprint(result.dashboard),
  };
}
```

`canonicalDashboardJson(input)` is the document normalized to version 2, keys
sorted, without whitespace and without `updatedAt`, so equal documents give
equal texts whatever their version, key order or save time.
`dashboardFingerprint(input)` is its SHA-256 (64 hexadecimal digits),
computed in pure TypeScript: synchronous, the same in browsers and on
servers.

## Building documents

The builders return new documents and never mutate their input:

| Function | Does |
| --- | --- |
| `createDashboard(id, name)` | An empty document with one grid section, `main` |
| `addDashboardSection(dashboard, { type, id?, title? }, index?)` | Adds an empty section (a free `section-N` id when the one given is taken or invalid) |
| `addDashboardWidget(dashboard, widget, { sectionId?, size?, index? })` | Adds a widget: in a grid at the first free spot, in a flow at `index`; a `table` goes to a flow (created when needed) |
| `moveWidgetToSection(dashboard, widgetId, sectionId, { index?, size? })` | Moves a widget to another section (or place in its flow); a grid card keeps its size |
| `removeDashboardWidget(dashboard, widgetId)` | Removes a widget, its place and its mentions in filter targets |
| `moveDashboardWidget`, `resizeDashboardWidget` | Keyboard moves and resizes: like a drag in a grid, up and down in a flow |
| `applyDashboardSectionLayout(dashboard, sectionId, items)` | Positions a section's gridstack reported |

## Rendering screens

`YayawDashboard` (React `yayaw-dashboard.tsx`, Vue
`dashboard/YayawDashboard.vue`) renders a document and what it names, the
same way in both editions:

```tsx
<YayawDashboard
  dashboard={screen} // or actions={{ dashboards }} and dashboardId
  sources={catalogue} // DashboardSources<DashboardTableSource>
  blocks={blocks} // the host's blocks, by key
  canEdit={canManage} // needs actions.dashboards.save
  showTitle={false} // the page around it shows the title
  unavailableWidgets="hide" // or "show", the default
  openView={(tableId, viewId, context) => router.push(listPage(tableId, viewId, context?.view))}
  locale="fr"
/>
```

| Prop | Default | Does |
| --- | --- | --- |
| `dashboard` | none | A document to show instead of loading one: fetched on the server, a draft preview, a screen written in code. Read with `normalizeDashboard` (and the host's `blocks`), shown again when it changes (an equal document keeps the edits in progress) |
| `actions.dashboards` | none | `list`, `load`, `save`, `remove`. Optional when `dashboard` is given and nobody edits: without `save`, "Edit" is not offered |
| `dashboardId` | the first listed | The document `load` reads |
| `sources` | none | The host's lazy catalogue (`list`, `load`); see [Sources on screen](#sources-on-screen) |
| `tables` | none | Sources given up front, by id; they win over `sources` (the only way before `sources`) |
| `blocks` | none | The host's blocks: `Record<key, DashboardBlock>`; see [Host blocks](#host-blocks) |
| `canEdit` | `false` | Edit mode: layout, widgets, filters and their default values; "Done" saves version 2 |
| `showTitle` | `true` | The name as the screen's `h2` |
| `unavailableWidgets` | `"show"` | `"hide"` leaves unavailable widgets and unknown blocks out of the view |
| `syncUrl` | `true` | Readers' filter values in the URL; full-page tables keep their own URL sync. `false` keeps both out of the URL |
| `openView` | none | "Open full view", "View all" and blocks call `openView(tableId, viewId, context?)`: `viewId` is null for inline settings and the default view, `context.view` is a widget's inline view |
| `renderMarkdown`, `displayModeRenderers`, `locale`, `translations`, `tableTranslations`, `getRowId`, `onChange` (Vue `change`) | | As for dashboards |

Sections render in order. A grid section is its own gridstack grid (stacked
on phones); a flow section stacks its widgets at full width and their natural
height (record views keep their pagination, charts take a 16:10 body).
Headings follow the page: the screen's name is an `h2`, a section title an
`h3`, a widget title an `h3` (or an `h4` under a section title).
`dashboardWidgetTitle` names a widget: its own title, else a number's label,
its saved view's name, the source's name (inline views, full-page tables) or
the block's `label` (its key when the host has none). In edit mode, grid
cards move and resize, flow widgets move up and down from their menu, and
"Add widget" adds to the first grid section.

### Sources on screen

`YayawDashboard` loads a source only when a widget on the screen reads it
(`dashboardSourceIds(dashboard)`: `view`, `kpi` and `table` widgets, in
display order; a filter never loads its targets), through
`createDashboardSourceLoader({ sources, tables })`: `tables` entries win, each
source loads once, a failed load stays failed until retried. Each widget
shows its source's state (`dashboardWidgetAvailability`):

| State | Shows |
| --- | --- |
| loading | "Loading…" |
| ready | The widget |
| error | The error and Retry (which calls `retry(id)`); "Refresh all" retries too |
| unavailable | A muted notice: the host's `message`, else a text for its reason ("You don't have access to this data.", "This source is not configured yet.", "This source no longer exists.", "This source is not available."), `[data-widget-state="unavailable"][data-widget-reason]` |
| unknown block | "Unavailable block" (`[data-widget-state="unknownBlock"]`) |

Unavailable widgets and unknown blocks stay in the document: edit mode shows
them (they can be removed), and "Done" saves them with their settings and
props. With `unavailableWidgets="hide"`, readers do not see them: grids close
the gaps (top gravity) and a section left empty disappears
(`dashboardVisibleSections`), for display only; the layout saved is the
document's. Edit mode shows every widget.

A loaded source is a `DashboardTableSource`: `{ config, actions, views?,
name?, tableProps?, renderTable? }` (the last two for full-page tables).

### Full-page tables

A `table` widget (flow sections only) renders the source's list page: the
table with its toolbar, saved views, selection, bulk actions and URL state,
without a card. Edit mode adds a bar with its title and menu (move up, move
down, remove); its heading shows only when the widget has a title of its own,
the section's and the screen's naming it otherwise (its region is labelled
with its title).

- **Host code** stays out of the document: `tableProps` (React
  `Partial<DataTableProps>`, Vue `YayawDataTable` props in camelCase) gives
  row, toolbar and bulk actions, `getFormConfig`, `details`, file tree hooks
  and the like. `renderTable(props)` wraps or replaces the table: it receives
  the props the dashboard would give `DataTable` / `YayawDataTable` and must
  pass them on. The dashboard keeps the table's id, config, actions and
  starting views.
- **Its view.** The widget's inline view becomes a system view of the table,
  `dashboardScreenView(dashboardId, widget, name)`: id
  `screen:<dashboardId>:<widgetId>` (`dashboardScreenViewId`,
  `isDashboardViewId`), `isSystem`, `isDefault`, first of `initialViews`. A
  reader arrives on their favorite view, else on this one. A widget's
  `viewId` becomes the default view instead (`dashboardTableViews`,
  `withDashboardTableViews` mark it in `views.list`). Views saved from the
  table keep `tableId = sourceId`, so the list page and the screen share them;
  hosts should not store `screen:` views.
- **URL keys.** The screen's first table in display order keeps the table's
  own keys (`view`, `<tableId>-…`), so links to the list page keep working;
  the others use `instanceId = widget.id`
  (`dashboardTableInstanceId(dashboard, widgetId)`).
- **Screen filters** reach every request as `requiredFilters`
  (`withDashboardFilters`); when they change, the table mounts again without
  the rows cached for the previous filters.

### Host blocks

A block is the host's code in a widget: `{ id, type: "block", block: key,
props }`. The host passes its registry as `blocks`:

```tsx
// React: dashboard-block.tsx
import type { DashboardBlockRegistry } from "@/components/ui/yayaw-table-dashboard/dashboard-block";

const blocks: DashboardBlockRegistry = {
  "media.storage": {
    label: { en: "Storage", fr: "Stockage" },
    group: "Media",
    placement: "grid",
    defaultSize: { w: 1, h: 2 },
    defaultProps: { unit: "GB" },
    propsSchema: { type: "object", properties: { unit: { enum: ["GB", "MB"] } } },
    component: StorageBlock, // receives DashboardBlockProps
  },
};
```

```ts
// Vue: dashboard/dashboard-types.ts
const blocks: DashboardBlockRegistry = {
  "media.storage": { label: "Storage", placement: "grid", component: StorageBlock },
};
```

`DashboardBlock` extends the pure `DashboardBlockSchema` (`label`,
`description`, `group`, `placement`, `defaultSize`, `defaultProps`,
`validateProps`, `propsSchema`: what `validateDashboard` and
`dashboardJsonSchema` read on a server) with `component` (a React component
or a Vue component) and an optional `settings` component for the screen
editor. `defineDashboardBlock<P>(block)` (React) types a block's props.

The component receives `DashboardBlockProps`:

| Prop | Is |
| --- | --- |
| `widgetId` | The widget's id |
| `props` | The widget's props over the block's `defaultProps` |
| `size` | `{ w, h }` in a grid section; none in a flow |
| `editing` | Whether the screen is in edit mode |
| `locale` | The screen's language |
| `revision` | Changes with "Refresh all" and after changes to the screen's data: load again |
| `filters` | The screen's filter values by filter id: `{ start, end, preset? }` for date ranges (presets resolved), options for selects |
| `refresh(tableId?)` | Reloads the widgets of a source, or all of them |
| `openView?` | The host's `openView` |

A block that throws shows its error in its widget only (an error boundary in
React, `onErrorCaptured` in Vue). A block may render nothing: in a flow
section its widget collapses (it shows while editing), in a grid it stays an
empty card. A key the host does not have shows "Unavailable block", and the
widget and its props are kept on save.

### Filters: readers' values and relative periods

The values a reader picks are view state, never written to the document:
each one is a URL key `<dashboardId>.<filterId>`
(`dashboardFilterUrlKey`), beside the table's keys:

| Value | In the URL |
| --- | --- |
| A relative period | `?cms.period=last30Days` |
| Days | `?cms.period=2026-09-01..2026-09-30`, `2026-09-01..`, `..2026-09-30` |
| Options | `?cms.author=Ada&cms.author=Sam` |
| Cleared while the document has a default | `?cms.period=` |

A value equal to the document's leaves the URL. The document's
`filters[].value` is the default; edit mode shows and changes the defaults
(entering it drops the reader's values), and only "Done" saves them. The
pure helpers are `readDashboardFilterValues`, `writeDashboardFilterValues`,
`encodeDashboardFilterValue`, `decodeDashboardFilterValue`,
`setDashboardViewerFilter` and `withDashboardFilterValues`.

Date range filters offer relative periods (`DASHBOARD_DATE_PRESETS`): the
last 7, 30 and 90 days (up to today), this month, last month and this year
(whole calendar months and years). A document may store one as its default
(`{ "preset": "last30Days" }`); `resolveDashboardDateRange(value, today)`
turns it into days when widgets query, in the reader's time zone, so rules
send days (`YYYY-MM-DD`) like every date rule. A number comparing periods
compares the preset's days with as many days before them.

### Refreshing

"Refresh all" loads every widget again: numbers, views and blocks (their
`revision`), full-page tables (React invalidates the table's query, since a
remount would show its cached rows; Vue calls the table's exposed
`refresh()`, or invalidates the query client it gave a host's
`renderTable`), and sources that failed to load. A change made in a
full-page table (`create`, `update`, `delete`, `duplicate`, the bulk actions,
`import.importRows`, the file tree's `move` and `createFolder`, wrapped by
`withMutationSignal(actions, onMutated)`) reloads the other widgets of that
source and the blocks, once for a burst of changes.

### Notices from the host

A `list` or `aggregate` answer may carry `meta.notice`: `{ code?, message? }`
(or a text) when the source has nothing to show for a reason, such as
`{ code: "notConfigured", message: "Connect an analytics provider." }`.
Numbers, views and full-page tables then show a muted notice
(`[data-widget-state="notice"][data-widget-reason=<code>]`) instead of empty
data: its `message`, else the text of a known code (`forbidden`,
`notConfigured`, `notFound`, `error`). The table stays mounted behind it, so
"Refresh all" asks again. `dashboardListNotice(result)` reads a notice,
`dashboardNoticeText(notice, locale)` words it; both editions type it as
`TableNotice` in the `list` and `aggregate` answers.

### Demo

`?example=screen` ("Content admin", `examples/screen.ts`, identical in both
editions) is a screen over a catalogue of ten sources, two of them
unavailable (`audit` forbidden, `billing` not configured) and one answering
`meta.notice` (`analytics`): an overview grid (published pages and drafts
over inline views, the storage of the media outside the trash, an "Audit
events" number whose source is forbidden, the `shortcuts` and `attention`
blocks, a gallery of recent uploads), then the Pages list page, wrapped by
the host's `renderTable`. The period and author filters reach the numbers,
the table and the attention block. The sources loaded are logged in
`window.yayawScreenSourceLoads`, requests in `window.yayawDashboardRequests`.
`?readonly` removes edit rights, `?hide` hides unavailable widgets, `?lang=fr`
shows it in French.

## TypeScript migration

- `Dashboard` is version 2. Type version 1 literals as `DashboardV1`, or as
  `unknown` when they are read from storage.
- `dashboard.layout` is now `dashboard.sections[…].layout` (grid sections).
- `applyGridLayout(section, items)` takes a section (any `{ layout }`); use
  `applyDashboardSectionLayout(dashboard, sectionId, items)` for a document.
- `addDashboardWidget(dashboard, widget, size)` still takes a size, or `{
  sectionId, size, index }`.
- `validateDashboard` returns `ok` and `migratedFrom`, and each issue has a
  `severity` and a `path`.
- `DashboardWidgetFrame` (React) and `DashboardWidget.vue` take `canMove`,
  `canResize`, `resizable`, `draggable` and `headingLevel` instead of `layout`
  and `phone`.
- The layout helpers live in `dashboard-layout.ts` and the grammar in
  `dashboard-schema.ts`; `dashboard-model.ts` still exports what moved.
- `DashboardBlockDefinition` is now `DashboardBlockSchema` (the old name
  remains as an alias), and a block's `name` is its `label`.
- `YayawDashboard`'s `actions` and `tables` are optional (`dashboard` or
  `sources` can replace them); `openView` receives a third argument,
  `{ view }`, for inline views.
- `table` and `block` widgets render (the "Not available yet" placeholder and
  its `dashboard.notAvailableYet` label are gone).
- Filter values picked in view mode no longer change the document (nor call
  `onChange`): they stay in the URL. Edit mode changes the defaults.
