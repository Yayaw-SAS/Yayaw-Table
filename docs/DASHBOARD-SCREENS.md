# Dashboard screens (JSON version 2)

A dashboard is a screen described by data: sections in order, the widgets
they place, and filters joined to the widgets' queries. Hosts store the JSON
(a database row, a file, a default written in code), render it with
`YayawDashboard` (React and Vue), and validate it on their servers with pure
modules that import no React, Vue or CSS. AI tools (MCP) prepare drafts with
the same grammar; people publish them.

This release ships the grammar and its tools, and a renderer that reads
version 2 in both editions:

| Ships now | Comes next |
| --- | --- |
| The version 2 grammar, migration from versions 0 and 1 | The full-page `table` widget (the table with its toolbar, saved views and URL) |
| `validateDashboard`, `checkDashboardReferences`, `dashboardJsonSchema` | Host blocks rendered in `block` widgets |
| `sanitizeViewConfig` for inline views | The `sources` prop (a lazy catalogue) in `YayawDashboard` |
| `dashboardFingerprint`, `canonicalDashboardJson`, builders | The screen editor (sections, widget wizard, view editor) |
| `createDashboardSourceLoader` and the source contract | The `?example=screen` demo |
| Sections, inline views and localized texts in `YayawDashboard` | |

Until then, `table` and `block` widgets render a neutral "Not available yet"
(`dashboard.notAvailableYet`), and are kept as they are when the document is
saved.

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
localized `label`. A target's `widgetIds` limit it to those widgets.

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
    name: { en: "Storage", fr: "Stockage" },
    placement: "grid",
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

## Rendering

`YayawDashboard` renders each section in order. A grid section is its own
gridstack grid (stacked on phones, as before). A flow section stacks its
widgets at full width: record views keep their pagination instead of fitting
a height, charts take a 16:10 body, and nothing scrolls inside. A titled
section shows its title (`h3`) and its widgets' titles one level lower
(`h4`). In edit mode, grid cards move and resize as before; flow widgets move
up and down from their menu. "Add widget" adds to the first grid section.
Inline views reach the embedded table as its `initialView`; "Open full view"
on such a widget calls `openView(tableId, null)`. "Done" saves version 2.

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
