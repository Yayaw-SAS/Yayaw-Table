# YaYaw Table

Flexible, type-safe data tables for React and Vue 3, distributed as Shadcn-compatible registries.

This repository contains the component sources, generated registry artifacts, tests, and release tooling. It does not contain or deploy a documentation website. The public surfaces are:

- [React and Vue documentation](https://yayaw.app/en/docs/table)
- [Documentation française](https://yayaw.app/fr/docs/table)
- [Interactive React demo](https://yayaw.app/en/table/example)
- [Démo React interactive](https://yayaw.app/fr/table/example)
- [Interactive Vue demo](https://table.yayaw.app/vue-example/)
- Static registry files under `https://table.yayaw.app/r/`, served by GitHub Pages

The registry host root is not an install target. Always use an explicit `/r/*.json` URL or the `@yayaw` namespace.

## Editions

- React: source of truth in `src/components/ui/yayaw-table`
- Vue 3: standalone package in `packages/yayaw-table-vue`
- Generated React registry: `registry/default/ui/yayaw-table`
- Published artifacts: `public/r`

## Install

React:

```bash
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
```

Vue 3:

```bash
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
```

Optional views are separate items, so the table does not depend on their
libraries. The calendar (FullCalendar) is
`https://table.yayaw.app/r/yayaw-table-calendar.json` for React and
`https://table.yayaw.app/r/yayaw-table-vue-calendar.json` for Vue: pass
`calendarRenderer` to `displayModeRenderers` and add `"calendar"` to
`displayModes`. Charts (bars, line, stacked or 100 % areas, bars and line
with a second axis, donut, funnel, number; shadcn/ui charts with Recharts in
React, Unovis in Vue, the same SVG funnel in both) are
`https://table.yayaw.app/r/yayaw-table-chart.json` and
`https://table.yayaw.app/r/yayaw-table-vue-chart.json`: pass `chartRenderer`
and add `"chart"`. Charts ask `actions.aggregate` for grouped values
(`groupBy`, `metrics`; bars-and-line charts ask for both metrics at once) and
fall back to the rows `list` returns; clicking a group (a bar, a point, a
funnel stage) filters the table to it with the rules its filter menus write.
Dashboards like Notion's are
`https://table.yayaw.app/r/yayaw-table-dashboard.json` and
`https://table.yayaw.app/r/yayaw-table-vue-dashboard.json`: `YayawDashboard`
arranges saved views of any table, numbers and notes on a 4-column grid
(gridstack.js, loaded on demand; stacked on phones) with dashboard filters
sent to each table's `list`/`aggregate`, and stores dashboards through
`actions.dashboards` (`list`, `load`, `save`, `remove`). Dashboards are JSON
version 2 screens (sections of grid cards and full-width flows, inline
views, texts per language); hosts validate them on their servers and describe
them to AI tools with the pure `dashboard-schema.ts` (`validateDashboard`,
`checkDashboardReferences`, `dashboardJsonSchema`), see
[docs/DASHBOARD-SCREENS.md](docs/DASHBOARD-SCREENS.md). The same component
renders admin screens: a document the host gives (`dashboard`), sources
loaded on demand from a catalogue (`sources`; forbidden or unconfigured ones
show a notice and are never removed), the host's `blocks`, full-page `table`
widgets (the list page with its toolbar, saved views and URL; `tableProps`
and `renderTable` for host code), filter values kept in the URL with relative
periods (last 30 days, this month…), "Refresh all" and `meta.notice` from the
host (`?example=screen` in both demos). Admins edit screens in place
(`canEdit` with `actions.dashboards.save`; the editor loads in a chunk of its
own): sections, a widget dialog (what, source, settings) over the catalogue
and the host's blocks, and "Edit view…", whose editor is the live table
(tables report their view with `onViewConfigChange` in React and
`view-config-change` in Vue); "Done" validates before saving. Nothing scrolls inside
a widget by default: lists, tables, boards, galleries and feeds show the
records that fit and "+N more · View all" (`settings.overflow: "scroll"`
scrolls instead), charts fill their widget, and numbers can compare with the
previous period and draw a trend line. Several tables on one page stay apart
with `instanceId`. The File tree view ships in the table items:
records linked by a parent column (`table.filetree.parentColumn`, or a column
named `parentId`) show as folders and files in a tree table; add `"filetree"`
to `displayModes`. It loads folders with `list({ scope: { kind: "children" } })`
and moves with `actions.tree.move` when the host provides them, and falls back
to the rows `list` returns and `update` otherwise; see
[docs/FILETREE.md](docs/FILETREE.md).
Maps (markers from a `location` column,
clusters, popups, the list of records in view; mapcn on MapLibre GL in React,
MapLibre GL in Vue) are `https://table.yayaw.app/r/yayaw-table-map.json` and
`https://table.yayaw.app/r/yayaw-table-vue-map.json`: pass `mapRenderer` and add
`"map"`. The basemap comes from the host (`table.map.style` or
`table.map.styles`; no tiles or API keys ship with the library, the demos use
keyless OpenFreeMap styles). MapLibre's worker loads from unpkg; to self-host
it (strict CSP, offline), copy both `maplibre-gl-worker.mjs` and
`maplibre-gl-shared.mjs` from `node_modules/maplibre-gl/dist/` into one folder
and set `table.map.workerUrl` to the worker (MapLibre 6's worker imports the
shared file next to it). "Search this area" sends
`scope: { kind: "bbox", field, west, south, east, north }` to `list`; hosts that
filter by it answer `meta.scope: "applied"`, otherwise the loaded rows are
filtered in the browser. `location` columns (`{ lat, lng, label?, address? }`)
work in cells, inline and form editors (address suggestions from
`actions.geocode`), filters (within N km, within an area), CSV import/export
("lat,lng") and connectors ("lat, lng" text). The Form view ships in the table items: add `"form"` to
`displayModes` (tables with a `create` action). Its standalone
`YayawTableForm` renders a saved Form view on a public route without table
state. Forms can show, hide and require questions by rule (`form.rules`,
also `FormConfig.rules` for create/edit and bulk forms) and ask one question
at a time (`form.layout: "steps"`), built on the shadcn Questionnaire: the
React item now lists the `questionnaire` shadcn component (and its
`@shadcn/react` package) as a dependency; the Vue item ships its own copy.
Hosts publish public forms from the saved view on their server with
`buildPublicFormSnapshot` (the snapshot passed by the browser is deprecated).
Form texts may be one string or one per language (`{ en: "Name", fr: "Nom" }`,
shown in `YayawTableForm`'s `locale`; `table.form.locales` lists the host's
languages for the settings' "Editing" switcher), a `consent` question adds a
required GDPR checkbox recorded in `metadata.consents`, and `hidden` questions
read a URL parameter (`utm_source`…), the page, the referrer or the language
into a column or `metadata.context`. `onSubmit` receives `meta.consents`,
`meta.fields` and `meta.locale` for the host's server, where
`acceptPublicFormResponse(snapshot, values, meta)` checks them again and
`withFormServerContext` adds what the server knows (page, revision, token).
Forms are edited in a near full-screen form builder ("Edit form" above the
Form view, or in View settings → Form): the outline of questions, sections,
consents and hidden fields on the left (drag or Alt + ↑ / ↓ to reorder), a
live preview in the language and layout being edited, and the selected
item's properties with its conditions; changes apply to the view with Save.
Forms never ask columns a host marks `readonly`, `editable: false`,
`computed`, `system`, `hidden` or `form: false`, nor metadata ids (`id`,
`createdAt`…); when the host's create form (`getFormConfig`) declares its
fields, forms ask only those.
The Feed view also ships in the table items: add `"feed"` to `displayModes`
for posts in a centered column (title, author and date, a clamped body with
"Show more", media and properties), loaded page by page from `list` as the end
comes within a screen (`infiniteScroll`, on by default; off, a "Load more"
button loads the next page, and it stays as the keyboard fallback). Its code
loads with the first feed shown, images load lazily in fixed boxes, videos show
their poster, and past 60 loaded posts only those near the viewport render
(`table.feed.windowing`: another count, or `false` to render every post). Bodies
are plain text unless `table.feed.renderBody` renders them (markdown or
sanitized HTML); `table.feed: false` turns it off.

Server connectors that push rows to Notion or Google Sheets, or sync them both
ways, are optional framework-agnostic items as well
(`yayaw-table-connector-notion`, `yayaw-table-connector-google-sheets`, and
their `yayaw-table-vue-connector-*` copies). The host provides credential
storage, sync state storage, authorization and workers; see
[docs/connectors.md](docs/connectors.md).

Both editions use TanStack Table 9.2.4 and require an ESM build targeting
ES2022 or newer. The Vue edition continues to require Vue `^3.5.0`; this
migration does not widen framework compatibility.

Pinned React releases are available under `/r/vX.Y.Z/yayaw-table.json`. Projects with the registry namespace configured can also use:

```bash
npx shadcn@latest add @yayaw/yayaw-table
```

## Use with AI agents

[`skills/yayaw-table`](skills/yayaw-table/SKILL.md) is an
[Agent Skill](https://agentskills.io) for coding agents such as Claude Code
and Codex. It tells them how to install, configure and extend YaYaw Table in
an app (registry items and pinned installs, `TableConfig`, display modes,
server contracts, forms, connectors, React/Vue parity and known pitfalls) and
sends them to the copied source and types, which remain the source of truth.

Copy the folder into your project, ideally from the release you installed
(add `--branch vX.Y.Z` to the clone):

```bash
git clone --depth 1 https://github.com/Yayaw-SAS/Yayaw-Table.git /tmp/yayaw-table-repo
# Claude Code: this project, or ~/.claude/skills/ for every project
mkdir -p .claude/skills && cp -R /tmp/yayaw-table-repo/skills/yayaw-table .claude/skills/
# Codex
mkdir -p .codex/skills && cp -R /tmp/yayaw-table-repo/skills/yayaw-table .codex/skills/
```

Agents load it when a task matches its description. In this repository,
`bun run skill:check` (part of `bun run check`) fails when the skill no longer
matches the code: display modes, actions, scope kinds, column types, filter
operators, registry items, helper names, paths and links.

## React quick start

```tsx
import { DataTable } from "@/components/ui/yayaw-table";
import { getTableActions, getTableConfig } from "./table-config";

export function ProductsTable() {
  return (
    <DataTable
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      tableType="products"
      title="Products"
    />
  );
}
```

Saved views support a personal favorite that opens on arrival and a personal order in both React and Vue: the view menu moves the current view left or right (up or down on phones), and the tabs, the "…" (More views) list and the menu follow each user's order, kept by `actions.views.setOrder` or in the browser. See [favorites, order and organization sharing](docs/SAVED-VIEWS.md) for the server integration contract and current permission boundaries.

The React edition supports shared TanStack Query state, typed filters, URL state with Nuqs, saved views, table/Kanban/gallery modes, forms, inline editing, and bulk actions. It can use Next.js Server Actions, regular HTTP APIs, or any backend adapter that implements the action contracts.

### Select a row range

In React and Vue table mode, `table.enableRowSelection: true` and
`table.enableMultiRowSelection: true` enable Shift-click on row checkboxes.
Click a checkbox to set the anchor, then Shift-click another to select or clear
an inclusive range in the current visible order. Selections outside the range
are preserved. Disabled rows, group headers, collapsed rows, and single-select
rows are excluded. Changing the visible order resets the anchor on the next
click. Bulk selection across server pages remains a separate action.

### Clear filters from either toolbar

Set `table.showClearFilters: true` in your table configuration to display an
icon at the far right of the toolbar. It clears column filters, advanced filters,
and global search, and returns to the first page. Sorting, grouping, column
layout, page size, and saved views are preserved. The flag defaults to `false`
and requires the toolbar to be visible. The icon stays available in both text
and icon action modes, including on mobile. Its tooltip and accessible label use
`filters.clear` from your translations. `showResetFilters` remains a supported
alias and now has the same behavior in React and Vue.

### Date filters send calendar days

Date rules compare whole days, so their values are days written `YYYY-MM-DD`
in both editions, for date and timestamp columns alike:
`{ operator: "between", values: ["2026-09-05", "2026-09-12"] }` includes both
days. The column filters, the chart's click-to-filter and the dashboards write
days, never the instant of the viewer's midnight, so a server that does not
know the viewer's time zone still reads the days they picked. Local filtering
(Vue's `data`, client fallbacks) compares the same days.

Links, saved views and presets written by older versions held instants such as
`2026-09-24T22:00:00.000Z` (25 September in Paris). Both editions read them as
the viewer's days, and an older saved view is not marked modified for it. On a
server, `normalizeDateFilterRules(rules, { timeZone })` from
`utils/date-filter-days.ts` does the same with the zone of the person who saved
the view. See the
[server contracts](skills/yayaw-table/references/server-contracts.md#date-rules).

### Empty states and filter recovery

Table, Kanban, and Gallery use the [Shadcn Empty component](https://ui.shadcn.com/docs/components/empty) in both editions. A filtered empty result offers a **Clear filters** button, even when the toolbar shortcut is disabled or the toolbar is hidden. It clears global search, column filters, and advanced filters and returns to page one. Sorting, grouping, column layout, display mode, page size, and the selected view remain unchanged; the saved view is not overwritten.

Without active filters, the state says **No data available** and hides the reset action. Inactive advanced rules do not count as active filters. `table.emptyState.title` and `description` override the default copy; `table.emptyState.show: false` hides the entire state in every display mode. Loading and errors do not show an empty result.

The React registry now declares `empty` as a Shadcn dependency. Reinstall the registry when upgrading, or run `bunx shadcn@latest add empty` if copying changes manually. Vue includes the Empty components and styles in its registry payload. No saved-view migration is required.

### Table density

The rows icon on the right of the toolbar offers six sizes. Tooltips appear on hover and keyboard focus and use the same translated labels as other table controls.

| Size | `table.density` | Row height before borders | Tailwind height |
| --- | --- | --- | --- |
| XS | `extra-small` | 28px | `h-7` |
| S | `small` | 32px | `h-8` |
| M | `medium` | 40px | `h-10` |
| L | `large` | 48px | `h-12` |
| XL | `extra-large` | 56px | `h-14` |
| 2XL | `extra-extra-large` | 64px | `h-16` |

XS preserves the previous compact S appearance. M remains the default. Padding, built-in controls, and thumbnails use coordinated Tailwind spacing units; text size stays unchanged and taller content can expand a row. Vue uses the same shared spacing factors without requiring Tailwind in the host application.

The selection stays with the table across display-mode changes and does not modify the configured default, URL state, or saved views. The density icon is hidden in Kanban and Gallery.

### Resize columns

Set `table.enableColumnResizing: true` to add accessible resize handles to data
columns. Drag with a pointer or use Left/Right Arrow, Home, and End while a
handle is focused. Double-click restores the configured width. Add
`enableResizing: false` to an individual column to keep it fixed. Resized widths
are included in saved views and shareable URLs in both React and Vue.

### Tags columns

A column with `tags: true` is a tags column: `multiSelect` columns hold a
list of tag ids, `select` columns one. With `actions.tags` in both editions,
its options are the host's catalog, loaded once per table and column when the
table mounts and cached, so cells, cards, filters, grouping and the record
view show the tags' names and colors:

```ts
columns: [{ id: "tags", header: "Tags", type: "multiSelect", tags: true, inlineEdit: true }],
// getTableActions(tableType)
tags: {
  list: ({ tableId, tableType, columnId }) => listTags(columnId), // [{ id, name, color? }]
  create: ({ columnId, name, color }) => createTag(columnId, name, color), // the new tag
  update: ({ id, name, color }) => updateTag(id, { name, color }), // color: null clears it
  merge: ({ sourceIds, targetId }) => mergeTags(sourceIds, targetId), // rewrites the records
  remove: ({ id }) => deleteTag(id), // and removes it from the records
},
```

- The tag picker (cells, record forms) searches names without case or
  accents and offers "Create “name”" (with `create`, unless the column sets
  `tags: { create: false }`): the tag is created, selected and cached at once.
- Bulk "Add tags" and "Remove tags" (tags columns holding lists, with
  `allowBulkEdit` and `bulkUpdate` or `update`) show the change at once and
  restore the rows that fail, which stay selected. By default `bulkUpdate`
  receives each group of rows' resulting lists; with `tags: { bulk: "patch" }`
  it receives `{ [field]: { add, remove } }` once, for the server to apply with
  `applyTagPatch()`.
- "Manage tags" in the column menu renames, recolors (a palette of named
  colors; any CSS color from the host shows too), merges and deletes tags,
  confirming a deletion with the number of records using the tag (one
  `aggregate` call grouped by the column). `table.canManageTags: false` or the
  column's `tags: { manage: false }` hide it.
- Tag colors: palette names (`TAG_COLOR_NAMES`) or CSS colors; tags without a
  color keep their automatic hue, and `coloredTags: false` shows neutral tags.

Without `actions.tags`, a tags column keeps its static `options`. See the
[server contracts](skills/yayaw-table/references/server-contracts.md#tag-catalogs);
`?example=assets&assets-display=table` shows a Tags column in both demos.

### Migrate from TanStack Table 8

Reinstall the registry so the generated `tanstack.ts` adapter and the TanStack
Table 9 dependency are updated together. Import table-bound TanStack types from
that local adapter when extending the copied components. TanStack 9 uses
`start`/`end` for its internal pinning state, while YaYaw's public saved-view and
URL contracts remain `left`/`right`; existing serialized views require no data
migration.

## Development

### Record consultation

React and Vue support a shared read-only record view in a drawer, modal, or page.
It includes typed values, update metadata, append-only activity with undo, and
Edit/Delete actions with confirmation. See [Record details](docs/RECORD-DETAILS.md)
for integration and the audit contract. Run the Vue demo and open
`/?example=record-details` to try all field types and presentations.


```bash
bun install
bun install --cwd packages/yayaw-table-vue
bun run type-check
bun run test
bun run vue:test
bun run vue:build
bun run registry:pages
```

After editing React source files, run `bun run registry:sync`. To rebuild every public registry artifact and the GitHub Pages bundle, run `bun run registry:pages`.

Release notes and SemVer bumps use Changesets. See [the release workflow](./docs/RELEASES.md).

## License

MIT

See [React and Vue compatibility](docs/FRAMEWORK-PARITY.md) for shared action contracts, catalogue forms, bulk editing, and reset behavior.

### Gantt examples

Try the [Gantt guide with embedded React and Vue examples](https://yayaw.app/en/docs/table/gantt),
or open the [React](https://yayaw.app/table-previews/react/index.html?example=gantt)
and [Vue](https://yayaw.app/table-previews/vue/index.html?example=gantt) examples directly.
Preview / Code, Reset and Expand use the same controls as the other documentation examples.
