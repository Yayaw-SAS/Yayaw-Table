---
name: yayaw-table
description: "Use when installing, configuring, extending or debugging YaYaw Table, the config-driven data table that the shadcn registry copies into React or Vue 3 apps (components/ui/yayaw-table, components/ui/yayaw-table-vue): registry items and pinned installs, TableConfig, columns and value formats, display modes (table, list, kanban, gallery, file tree, calendar, chart, feed, map, form, Gantt) and dashboards, saved views and URL state, the server contracts behind table actions (list, aggregate, create, update, delete, import, export, geocode, tree, form links, destinations and connectors), catalogue forms and public form links, Notion and Google Sheets sync, and React/Vue parity."
---

# YaYaw Table

YaYaw Table is a config-driven data table for React and Vue 3. It ships as
shadcn registry items, not as an npm package: the shadcn CLI copies its source
into the app, under `components/ui/yayaw-table/` (React) or
`components/ui/yayaw-table-vue/` (Vue) inside the folder the app's
`components.json` aliases point to. The two editions are one product: the same
configuration, the same serialized state (saved views, URL keys) and the same
action contracts, so one backend serves both.

## Ground rules

1. **The installed code is the source of truth.** It is the exact version the
   app runs. Read the files below before writing configuration or backend
   code, and trust them over these notes when they disagree.
2. **Server first.** Implement `actions.list` so the server searches, filters,
   sorts and pages, and `actions.aggregate` for calculations and charts. Most
   optional actions have a browser fallback that loads rows through `list`
   and computes locally (every matching row for exports and footer totals, at
   most 2,000 for charts, calendars, maps and trees): fine for small tables,
   wrong for big ones.
3. **Never trust the browser.** `allowEdit`, `canEditRow`, `allowViewSharing`,
   a view's `canEdit` or a Form view's snapshot only shape the interface. The
   server re-checks identity, permissions, record versions and values on every
   action, and builds anything published or sent elsewhere (public forms,
   exports, connector runs) from its own data.
4. **Both editions, one outcome.** Names, defaults, URL keys and contracts are
   shared. The few framework differences are listed in
   [configuration](references/configuration.md#react-and-vue-differences).
5. **Extend, don't fork.** Reinstalling an item overwrites its folder. Use the
   extension points (`cellRenderer`, `filterRenderer`, `displayModeRenderers`,
   `toolbarActions`, `rowActions`, `customBulkActions`, `details`, form
   `blocks`, `table.feed.renderBody`) before patching copied files; if you
   patch, write down why so the patch survives upgrades.

## Where the truth lives

Paths are registry targets; prefix them with your components folder (for
example `src/`).

| What | React | Vue |
| --- | --- | --- |
| Public exports | `components/ui/yayaw-table/index.ts` | `components/ui/yayaw-table-vue/index.ts` |
| `TableConfig`, `ColumnDefinition`, table flags | `components/ui/yayaw-table/config/helpers.ts` | `components/ui/yayaw-table-vue/types.ts` |
| Default flags | `components/ui/yayaw-table/config/defaults.ts` | `components/ui/yayaw-table-vue/config.ts` |
| `TableActions` (server contract) | `components/ui/yayaw-table/providers/table-provider.tsx` | `components/ui/yayaw-table-vue/types.ts` |
| Display mode registry | `components/ui/yayaw-table/utils/display-modes.ts` | `components/ui/yayaw-table-vue/display-modes.ts` |
| Renderer contract | `components/ui/yayaw-table/types/display-mode-renderer.ts` | `components/ui/yayaw-table-vue/display-mode-renderer.ts` |
| List parameters, filter engine, column types | `components/ui/yayaw-table/utils/table-contracts.ts` | `components/ui/yayaw-table-vue/table-contracts.ts` |
| Date rule values (`YYYY-MM-DD` days) | `components/ui/yayaw-table/utils/date-filter-days.ts` | `components/ui/yayaw-table-vue/date-filter-days.ts` |
| List scopes | `components/ui/yayaw-table/utils/scoped-rows.ts` | `components/ui/yayaw-table-vue/scoped-rows.ts` |
| Saved views | `components/ui/yayaw-table/types/view-types.ts` | `components/ui/yayaw-table-vue/types.ts` |
| Number and date formats | `components/ui/yayaw-table/utils/value-format.ts` | `components/ui/yayaw-table-vue/value-format.ts` |
| Translations | `components/ui/yayaw-table/types/translations.ts` | `components/ui/yayaw-table-vue/translations.ts` |

Each feature keeps its settings, labels and helpers in one framework-neutral
model (`utils/chart-model.ts`, `utils/form-view.ts`,
`utils/filetree-model.ts`…; at the root of the Vue folder) that both editions
share.

Repository documentation (read the one matching the task):
[framework parity](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/FRAMEWORK-PARITY.md),
[connectors](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/connectors.md),
[file tree](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/FILETREE.md),
[saved views](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/SAVED-VIEWS.md),
[record details](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/RECORD-DETAILS.md),
[Gantt](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/GANTT.md),
[planning engine](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/PLANNING-ENGINE.md),
[planning adapters](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/PLANNING-ADAPTERS.md).
Public guides: https://yayaw.app/en/docs/table (French: https://yayaw.app/fr/docs/table).

## Workflow

1. **Identify the edition and the state.** React when the app has
   `components/ui/yayaw-table/` or uses React; Vue with
   `components/ui/yayaw-table-vue/`. Read `components.json` (aliases, style)
   and, for React, check `@tanstack/react-query`, `nuqs` and `sonner`.
2. **Install or upgrade** the core item and only the optional items you need:
   [install](references/install.md).
3. **Mount the providers and one table** (below) with `actions.list` backed by
   the server.
4. **Describe the table** with `defineTableConfig()`:
   [configuration](references/configuration.md).
5. **Implement the actions** the features need, server first:
   [server contracts](references/server-contracts.md).
6. **Add display modes, forms, dashboards and connectors**:
   [display modes](references/display-modes.md),
   [forms](references/forms.md), [connectors](references/connectors.md).
7. **Verify**: type-check, open every mode with realistic data (thousands of
   rows, empty values, long text), run [testing](references/testing.md) and
   scan [pitfalls](references/pitfalls.md).

## Install in one minute

```bash
# React: shadcn/ui on Base UI (a base-* style such as base-vega), Tailwind, TanStack Query, nuqs, sonner
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# Vue 3.5+: self-contained styles that read the shadcn CSS variables, vue-sonner
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
```

Optional items keep heavy libraries out of the table: calendar (FullCalendar),
chart (Recharts in React, Unovis in Vue), map (MapLibre), dashboard
(gridstack) and the server-only Notion and Google Sheets connectors. Pin a
release with `https://table.yayaw.app/r/vX.Y.Z/<item>.json` and check its
SHA-256 against the GitHub release asset. Item list, host requirements and the
upgrade routine: [install](references/install.md).

## Minimal setup

React (a client component; in Next.js App Router put `"use client"` on top,
because functions such as `getTableActions` cannot cross the server boundary):

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app"; // or nuqs/adapters/react, nuqs/adapters/react-router…
import { useState } from "react";
import { Toaster } from "sonner";
import { DataTable, defineTableConfig } from "@/components/ui/yayaw-table";
import type { TableActions } from "@/components/ui/yayaw-table/providers/table-provider";
import { listProjects, updateProject } from "@/server/projects"; // your server functions

const projects = defineTableConfig({
  id: "projects",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "select", displayVariant: "tag",
        options: [{ value: "active", label: "Active" }, { value: "done", label: "Done" }] },
      { id: "budget", header: "Budget", type: "number", numberFormat: { style: "currency", currency: "EUR" } },
      { id: "dueDate", header: "Due", type: "date" },
    ],
    order: ["select", "name", "status", "budget", "dueDate", "actions"],
    visible: ["name", "status", "budget", "dueDate"],
    mandatory: ["name"],
    sort: [{ id: "dueDate", desc: false }],
  },
  table: { displayModes: ["table", "kanban"], kanban: { groupBy: "status", titleColumn: "name" } },
  translations: { namespace: "projects", keys: { title: "Projects" } },
});

const actions: TableActions = {
  list: (params) => listProjects(params), // server: search, filters, sort, page
  update: (id, patch, context) => updateProject(id, patch, context?.row),
};
// Stable references: a new function on every render reloads the table.
const getTableConfig = () => projects;
const getTableActions = () => actions;

export function ProjectsPage() {
  const [queryClient] = useState(() => new QueryClient()); // one client for the whole app
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <DataTable getTableActions={getTableActions} getTableConfig={getTableConfig} tableType="projects" />
        <Toaster />
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
```

In a real app the `QueryClientProvider`, `NuqsAdapter` and `Toaster` live once
in the root layout. React throws without a `QueryClient` (or with a second one
passed as a prop), and needs `NuqsAdapter` even with `table.syncUrl: false`.

Vue:

```vue
<script setup lang="ts">
import { QueryClient } from "@tanstack/vue-query";
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";
import { YayawDataTable, defineTableConfig, type TableActions } from "@/components/ui/yayaw-table-vue";
import { listProjects, updateProject } from "@/api/projects";

const projects = defineTableConfig({ /* the same object as in React */ });
const actions: TableActions = { list: listProjects, update: (id, patch, context) => updateProject(id, patch, context?.row) };
const getTableActions = () => actions;
const queryClient = new QueryClient(); // optional: share it to share the cache
</script>

<template>
  <YayawDataTable table-type="projects" :config="projects" :get-table-actions="getTableActions" :query-client="queryClient" />
  <Toaster />
</template>
```

Vue also accepts `:get-table-config` instead of `:config`, and local rows
through `:data` when there is no `list` action. Mount one `Toaster` for the
whole app (the table never mounts its own).

## TableConfig at a glance

`defineTableConfig({ id, columns, table, translations, form?, presentation?,
toolbarActions?, toolbarActionsPlacement? })` fills every flag with its
default. Point `getTableConfig(tableType)` at a catalogue of configs;
`tableId` (default `tableType`) names the instance for URL keys and caches.

- `columns.definitions`: `{ id, header, type, options?, numberFormat?,
  dateDisplayPreset?, dateFormat?, timeZone?, displayVariant?, inlineEdit?,
  enableSorting?, enableFiltering?, enableGrouping?, cellRenderer? }`.
  `columns.order`, `visible`, `mandatory` and `sort` (the starting sort) are
  column ids; `select` and `actions` are the utility columns.
- `table`: feature flags (`allowCreate`, `allowEdit`, `enableViews`,
  `syncUrl`, `density`, `displayModes`, `defaultDisplayMode`…) and one object
  per display mode (`table.kanban`, `table.chart`…).
- **A format applies everywhere.** Set `numberFormat`, `dateDisplayPreset` /
  `dateFormat`, `timeZone` and `hour12` on the column once: cells, totals,
  group headings, cards, record details, the Form view, feed, calendar,
  Gantt, map popups, charts, dashboards, filter chips and formatted exports
  all read it, and imports read it back. Return raw values from the server
  (numbers, ISO dates, `YYYY-MM-DD` days), never pre-formatted text.

Column types, every flag, formats, translations, URL state, saved views and
multi-instance pages: [configuration](references/configuration.md).

## Choose a display mode

<!-- skill-check: display-modes -->
| Mode | Use it for | It needs | Ships in |
| --- | --- | --- | --- |
| `table` | Dense work: sort, filter, group (two levels), calculations, inline edit, bulk actions | nothing | core |
| `list` | One line per record, a title and a few properties; manual order by drag | `table.list.titleColumn` (else guessed) | core |
| `kanban` | Cards in lanes; moving a card updates its lane column | a select or tag column (`table.kanban.groupBy`), `actions.update` | core |
| `gallery` | Image cards, media viewer (image, video, audio, PDF) | an image column (`table.gallery.imageColumn`) or `table.gallery.media`; placeholders otherwise | core |
| `filetree` | Folders and files linked by a parent column | `table.filetree.parentColumn`, or a column named `parentId`, `parent`, `folderId`… | core, offered when a parent column exists |
| `calendar` | Records on a month, week or list calendar | a date column (and an end column to stretch) | `yayaw-table-calendar`, `yayaw-table-vue-calendar` |
| `chart` | Bars, line, areas, bars and line, donut, funnel or a single number | a column to group by; `actions.aggregate` for server groups | `yayaw-table-chart`, `yayaw-table-vue-chart` |
| `feed` | Posts in a column: updates, news, comments | title, body and date columns (guessed); `list` paging | core, on unless `table.feed: false` |
| `map` | Markers, clusters, "Search this area" | a `location` column and a basemap (`table.map.style`) | `yayaw-table-map`, `yayaw-table-vue-map` |
| `form` | A form that creates records, also on a public link | `actions.create` and `allowCreate` | core, offered when the table can create |
| `gantt` | Schedules with dependencies, hierarchy and calendars | `table.planning.enabled`, `table.gantt.startColumn` and `endColumn`, `list` (or `actions.planning`) | core |

- List the modes in `table.displayModes`; `defaultDisplayMode` picks the one
  shown first. A mode that cannot render (missing renderer, no parent column,
  no planning graph) is withheld, and links or views asking for it fall back.
- Optional items render through `displayModeRenderers`: React
  `displayModeRenderers={{ calendar: calendarRenderer, chart: chartRenderer,
  map: mapRenderer }}`, Vue `:display-mode-renderers="…"`. Chart and map load
  their library lazily; import the calendar renderer only where it is used.
- `table.<mode>` holds defaults; each saved view keeps its own settings, also
  in the `<tableId>-<mode>` URL key. `table.chart`, `feed`, `filetree`, `map`
  and `form` accept `false` to turn the mode off.
- Dashboards are not a mode: `YayawDashboard` (items `yayaw-table-dashboard`,
  `yayaw-table-vue-dashboard`) arranges views of several sources, numbers,
  notes, full-page tables and host blocks; admin screens use it with a lazy
  `sources` catalogue.

Per-mode settings, contracts and fallbacks, dashboards and custom renderers:
[display modes](references/display-modes.md).

## Server contract

Every action is optional. `getTableActions(tableType)` returns them; each one
runs where you implement it (fetch, server action, RPC), so authorize there.

<!-- skill-check: actions -->
| Action | Used by | Without it |
| --- | --- | --- |
| `actions.list` | Rows of every mode: page, sort, search, filters, AND/OR, scopes | React shows no rows; Vue filters its `data` locally |
| `actions.aggregate` | Footer calculations, chart groups | Loads the matching rows through `list` and computes in the browser |
| `actions.create` | Create form, Form view, calendar day click, imports, new folders | No Create button, no Form mode |
| `actions.update` | Edit form, inline edit, Kanban, calendar and derived Gantt moves, renames, imports | Read-only records |
| `actions.delete` | Row and record deletion, file tree deletion | No Delete |
| `actions.duplicate` | Duplicate and Ctrl/Cmd+D | No Duplicate |
| `actions.bulkDelete` | Deleting a selection in one call | Deletes row by row with `delete` |
| `actions.bulkUpdate` | The built-in bulk editor (when there is no `onBulkEdit`) | No bulk edit unless `onBulkEdit` is passed |
| `actions.bulkCopy` | Bulk Copy (after `onBulkCopy`) | React copies the rows as JSON; Vue hides Copy |
| `actions.reorder` | "Manual order" sort (`table.manualOrder`) | No manual order |
| `actions.views` | Saved views and the personal favorite | Views and favorite in `localStorage`, per browser |
| `actions.tree` | File tree path, moves, new folders | Parent-column walk, `update`, `create` |
| `actions.planning` | Transactional Gantt (preview, apply, dependencies) | Derived from `list` and `update`, no dependencies |
| `actions.import` | Import sources, server bulk writes, key lookup | CSV through `create` and `update`, keys through `list` |
| `actions.exportFile` | Server-built CSV, Excel and PDF | Browser CSV and printed PDF, no Excel |
| `actions.geocode` | Address suggestions for `location` columns and imports | Coordinates only; addresses cannot import |
| `actions.formLinks` | Publishing Form views on public links | No "Share form" |
| `actions.destinations` | Data › Connect and Share rows, connector screens, schedules | Only the built-in export and link |

`list` receives both naming conventions (`page` from **1**, `pageSize` and
`limit`, `sorting` and `orderBy`, `search`, `q` and `globalSearch`), plus
`filters`, active `advancedFilters` with `advancedFilterJoin` (`"and"` or
`"or"`), `grouping`, `viewId` with the manual-order sort, `requiredFilters`
from dashboards (always AND) and an optional `scope`. It answers
`{ data, meta: { totalCount, pageCount, scope? } }`. Mutations answer
`{ success, data?, error?, fieldErrors?, failedIds? }`.

<!-- skill-check: scopes -->
| Scope kind | Sent by | Answer |
| --- | --- | --- |
| `dateRange` | Calendar and scoped loaders: `{ field, endField?, from, to }`, inclusive local days | Rows overlapping the days |
| `bbox` | Map: `{ field, west, south, east, north }`; `west > east` crosses the antimeridian | Rows inside the area |
| `children` | File tree folder: `{ parentId }`, `null` for the root | Direct children, 200 per page, `meta.childCounts` |
| `subtree` | File tree "Expand all": `{ parentId }` | Every descendant, `meta.truncated` when capped |
| `tree-matches` | File tree search | Matches plus `meta.ancestors` |

Answer `meta.scope: "applied"` when the server honoured the scope; otherwise
the table loads the query's rows (capped) and filters them in the browser.
Full parameter tables, filter operators, result shapes and every nested
contract: [server contracts](references/server-contracts.md).

## Forms, public forms, connectors

- **Record forms** come from the columns, or from `getFormConfig(formType)`
  returning a `FormConfig` (validation, conditional `rules`, `blocks`,
  collections, `tablePicker`, async options, `submitMode: "patch"`).
- **Form view and public links**: the Form mode creates records;
  `YayawTableForm` renders a saved Form view without table state. To publish,
  the host builds the snapshot on its server with `buildPublicFormSnapshot()`,
  serves it, and re-validates each response with `acceptPublicFormResponse()`.
  Ignore the snapshot argument `formLinks.publish` still receives from the
  browser.
- **Connectors** (Notion, Google Sheets) are server-only modules: push, two-way
  sync with `planSync()` and `applySyncPlan()`, conflict rules, target health
  checks. The host stores credentials and sync state, authorizes, and runs
  workers.

Details: [forms](references/forms.md), [connectors](references/connectors.md).

## Parity and tests

A behaviour that exists in one edition exists in the other, with the same
names, defaults and serialized state. When you change YaYaw Table itself
(this repository), change both editions in the same pull request, add or
extend the shared suite (`tests/*-suite.ts`, run by both test runners) and the
Playwright spec (run against both demos), update `docs/FRAMEWORK-PARITY.md`,
add a changeset, and keep this skill in sync (`bun run skill:check`). In a
host app, test the server contract (operators, OR joins, scopes, paging,
authorization) rather than the copied components. See
[testing](references/testing.md).

## Pitfalls that cost the most

- **Pre-formatted values**: return raw numbers and dates; formats are column
  settings, and exports choose formatted or raw values themselves.
- **OR filters and dashboard filters ignored by the server**: honour
  `advancedFilterJoin: "or"`, and AND `requiredFilters` with everything else.
- **`initialData` that does not match the first request**: it only stands for
  page 1 with the default page size, no search or filters, and the
  configured `columns.sort`; since 3.6.1 React ignores it whenever
  `columns.sort` is set.
- **Unstable `getTableActions` / `getTableConfig`**: define them outside render
  (or memoize); a new identity rebuilds planning and refetches.
- **Missing React providers**: one `QueryClient`, a `NuqsAdapter`, one
  `Toaster`; with SSR, the server renders the default state and the URL is
  applied on the client.
- **Partial React translations**: React does not merge; spread
  `defaultTranslations` and override. Vue merges over its English and French
  defaults.
- **Self-hosted map worker**: `table.map.workerUrl` needs both
  `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` in the same folder.
- **Trusting the client**: build public form snapshots, exports and connector
  rows on the server; UI flags are not permissions.

More, with symptoms and fixes: [pitfalls](references/pitfalls.md).

## References

- [install](references/install.md): items, pinned versions and SHA-256, host requirements, upgrades.
- [configuration](references/configuration.md): columns, types, flags, formats, translations, URL state, saved views, instances, React and Vue differences.
- [display modes](references/display-modes.md): each mode, dashboards, record details, custom renderers.
- [server contracts](references/server-contracts.md): every action, parameter, result and fallback.
- [forms](references/forms.md): catalogue forms, conditions, Form view, public links and their security.
- [connectors](references/connectors.md): Notion and Google Sheets, sync engine, conflicts, host duties.
- [testing](references/testing.md): parity rules, suites, Playwright, checks.
- [pitfalls](references/pitfalls.md): symptoms, causes and fixes.
