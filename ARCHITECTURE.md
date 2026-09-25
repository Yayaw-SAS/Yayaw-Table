# YaYaw Table - Architecture

YaYaw Table is a configuration-driven data table distributed as shadcn
registry items: the CLI copies the source into the host project, and no npm
package is involved. It has two editions with the same behavior, the same
configuration and the same server contracts:

- **React**: shadcn/ui with Base UI primitives, TanStack Table and Query,
  jotai and nuqs. Registry item `yayaw-table`, installed under
  `components/ui/yayaw-table/`.
- **Vue 3**: Reka UI, TanStack Vue Table and Vue Query. Registry item
  `yayaw-table-vue`, installed under `components/ui/yayaw-table-vue/`.

The split of work is fixed: the table owns the interface and the client logic
(display modes, filters, sorting, grouping, saved views, forms, bulk actions,
URL state), and the host provides the data through server actions.

## Configuration and host actions

A host describes each table with a `TableConfig` (`defineTableConfig`): column
definitions and their types and value formats, table options, the display
modes to offer and their settings. React reads it through `getTableConfig`
and the host's actions through `getTableActions`, both keyed by `tableType`:

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

Rows come from the host's `actions.list(params)`, server first: the host
pages, sorts, filters and searches. `params.scope` asks for the window a view
needs (a date range for Calendar, a map area for Map, children for File
tree), and the host answers `meta.scope: "applied"` when it honored it.
Every other action is optional; without one, the table hides the matching
interface or falls back to client-side work where it can: `aggregate`
(charts, column calculations, dashboards), `create`, `update`, `delete`,
`duplicate`, `bulkUpdate`, `bulkDelete`, `bulkCopy`, `reorder`, `views`,
`tree`, `exportFile`, `import`, `formLinks` and `geocode`. The Vue edition can
also filter, sort and page a local `data` array. The complete contracts are in
the [README](README.md) and the
[agent skill](skills/yayaw-table/references/server-contracts.md).

## Display modes

`utils/display-modes.ts` is the single registry of display modes
(`DISPLAY_MODES`, and `TableDisplayMode` derived from it): `table`, `list`,
`kanban`, `gallery`, `filetree`, `calendar`, `chart`, `feed`, `map`, `form`
and `gantt`. It declares each mode's capabilities, settings key and
availability; renderers, settings panels and icons are keyed by mode, so the
type checker lists every place a new mode must fill.

Views with heavy dependencies ship as optional registry items so the core stays
free of them:

| Item (React / Vue) | Adds | Library |
| --- | --- | --- |
| `yayaw-table-calendar` / `yayaw-table-vue-calendar` | Calendar | FullCalendar |
| `yayaw-table-chart` / `yayaw-table-vue-chart` | Chart | Recharts / Unovis |
| `yayaw-table-map` / `yayaw-table-vue-map` | Map | MapLibre (mapcn) |
| `yayaw-table-dashboard` / `yayaw-table-vue-dashboard` | Dashboard of saved views | gridstack |
| `yayaw-table-connector-notion`, `yayaw-table-connector-google-sheets` (and Vue) | Server modules for two-way sync | none |

## Shared logic

Framework-agnostic modules are written once, in
`src/components/ui/yayaw-table/utils/` (view models, form conditions,
connectors, exports, import, contracts), and copied into the Vue package by
`scripts/sync-table-contracts.mjs` (`bun run contracts:sync`). The optional
dashboard items share their grammar, layout and model the same way; the
grammar (`dashboard-schema.ts`, see [Dashboard screens](docs/DASHBOARD-SCREENS.md))
and `utils/view-config.ts` import no React, Vue or CSS, so hosts run them on
their servers. Shared test
suites (`tests/*-suite.ts`) run against both copies, so the two editions
cannot drift on behavior. The few framework-native differences are listed in
[Framework parity](docs/FRAMEWORK-PARITY.md).

## State

- **Server data**: TanStack Query in both editions, keyed by table. The Vue
  table creates its own client unless the host passes `queryClient`.
- **Client state**: jotai atoms per table in React, composables in Vue.
  `instanceId` isolates several instances of the same table on one page.
- **URL**: both editions write `<tableId>-…` query keys (nuqs in React, the
  History API in Vue), so a link restores the view, filters, sort and page.
  The few keys only React writes are listed in Framework parity.
- **Saved views** serialize the same state in both editions; see
  [Saved views](docs/SAVED-VIEWS.md).

## Repository layout

| Path | Contents |
| --- | --- |
| `src/components/ui/yayaw-table/` | React source: components, hooks, atoms, config, providers, types, utils, and the form, feed, file tree, planning and connector modules |
| `src/components/ui/yayaw-table-{calendar,chart,dashboard,map}/` | Optional React items |
| `src/components/ui/*.tsx` | shadcn components used by the table; hosts install them from shadcn |
| `packages/yayaw-table-vue/` | Vue edition: source, demo and registry build |
| `registry/` | React registry source (`registry.json`) and generated files (`registry/default/`) |
| `public/r/` | Built registry JSON for both editions, with immutable release snapshots under `public/r/vX.Y.Z/` |
| `examples/` | React examples; `examples/record-presentation-preview` is the demo app used by the end-to-end tests |
| `tests/`, `e2e/` | Bun tests (including the shared suites) and Playwright suites that run against the React and Vue demos |
| `skills/yayaw-table/` | Agent skill, checked against the code by `bun run skill:check` |
| `scripts/` | Registry build, contract sync, release snapshot and verification, changeset and skill validation |
| `docs/` | Feature specifications and maintenance guides |

## Further reading

- [README](README.md): installation, features and configuration.
- [Testing](TESTING.md), [Releases](docs/RELEASES.md) and
  [CI maintenance](docs/CI-MAINTENANCE.md).
- Feature specifications: [File tree](docs/FILETREE.md),
  [Gantt](docs/GANTT.md), [Record details](docs/RECORD-DETAILS.md),
  [connectors](docs/connectors.md) and the
  [planning engine](docs/PLANNING-ENGINE.md).
