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
`displayModes`. Charts (bars, line, donut, number; shadcn/ui charts with
Recharts in React, Unovis in Vue) are
`https://table.yayaw.app/r/yayaw-table-chart.json` and
`https://table.yayaw.app/r/yayaw-table-vue-chart.json`: pass `chartRenderer`
and add `"chart"`. Charts ask `actions.aggregate` for grouped values
(`groupBy`, `metrics`) and fall back to the rows `list` returns; clicking a
group filters the table to it. Dashboards like Notion's are
`https://table.yayaw.app/r/yayaw-table-dashboard.json` and
`https://table.yayaw.app/r/yayaw-table-vue-dashboard.json`: `YayawDashboard`
arranges saved views of any table, numbers and notes on a 4-column grid
(gridstack.js, loaded on demand; stacked on phones) with dashboard filters
sent to each table's `list`/`aggregate`, and stores dashboards through
`actions.dashboards` (`list`, `load`, `save`, `remove`). Several tables on one
page stay apart with `instanceId`. The File tree view ships in the table items:
records linked by a parent column (`table.filetree.parentColumn`, or a column
named `parentId`) show as folders and files in a tree table; add `"filetree"`
to `displayModes`. It loads folders with `list({ scope: { kind: "children" } })`
and moves with `actions.tree.move` when the host provides them, and falls back
to the rows `list` returns and `update` otherwise; see
[docs/FILETREE.md](docs/FILETREE.md). The Form view ships in the table items: add `"form"` to
`displayModes` (tables with a `create` action). Its standalone
`YayawTableForm` renders a saved Form view on a public route without table
state. Forms can show, hide and require questions by rule (`form.rules`,
also `FormConfig.rules` for create/edit and bulk forms) and ask one question
at a time (`form.layout: "steps"`), built on the shadcn Questionnaire: the
React item now lists the `questionnaire` shadcn component (and its
`@shadcn/react` package) as a dependency; the Vue item ships its own copy.
Hosts publish public forms from the saved view on their server with
`buildPublicFormSnapshot` (the snapshot passed by the browser is deprecated).
The Feed view also ships in the table items: add `"feed"` to `displayModes`
for posts in a centered column (title, author and date, a clamped body with
"Show more", media and properties), loaded page by page from `list` with
"Load more" or on scroll. Bodies are plain text unless `table.feed.renderBody`
renders them (markdown or sanitized HTML); `table.feed: false` turns it off.

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

Saved views support a personal favorite that opens on arrival in both React and Vue. See [favorite persistence and organization sharing](docs/SAVED-VIEWS.md) for the server integration contract and current permission boundaries.

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
