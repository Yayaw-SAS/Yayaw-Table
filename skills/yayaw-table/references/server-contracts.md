# Server contracts

`TableActions` is typed in React
`components/ui/yayaw-table/providers/table-provider.tsx` and Vue
`components/ui/yayaw-table-vue/types.ts`; both editions call the same actions
with the same arguments. Each action is an async function the host writes: a
fetch to an API route, a Next.js server action, an RPC call. The browser calls
it, so the server side must:

- resolve the user and tenant from the session, never from arguments;
- authorize the table, the rows and the fields on every call (UI flags such as
  `allowEdit` or `canEditRow` are not permissions);
- validate values and record versions, and return expected failures as data
  (`{ success: false, error, fieldErrors }`) so forms keep their drafts.

`compatibleListParams()` and `matchesContractFilter()` (in
`components/ui/yayaw-table/utils/table-contracts.ts`, pure and safe on a
server) are the reference for parameter names and filter semantics.

## `list`

| Parameter | Meaning |
| --- | --- |
| `page` | Page number, starting at **1** (the URL's page index starts at 0). |
| `pageSize`, `limit` | Page size, a positive integer (at most 500 from automatic sizing). |
| `sorting`, `orderBy` | Every sort in priority order: `[{ id, desc }]`, and the same as `{ [id]: "asc" \| "desc" }`. Empty: keep your natural order. `__manual` means the view's manual order (with `viewId`). |
| `search`, `q`, `globalSearch` | Global search text. |
| `filters` | Column filters by column id (column menus, filter bar, `filterRenderer`), in the shape the column's filter control writes. |
| `advancedFilters` | Active rules `{ id, columnId, operator, values, type? }[]` (inactive rules are not sent). |
| `advancedFilterJoin` | `"and"` or `"or"` between the advanced rules. |
| `grouping` | Grouping column ids of the view. |
| `viewId` | Saved view id (`null` for the default view), sent with the manual-order sort. |
| `requiredFilters` | Dashboard filter rules: AND them with everything else, whatever `advancedFilterJoin` says. |
| `scope` | Optional window: `dateRange`, `bbox`, `children`, `subtree`, `tree-matches` (see SKILL.md). |

Answer `{ data, meta }`: `data` rows with stable ids (or pass `getRowId`),
`meta.totalCount` and/or `meta.pageCount`, `meta.scope: "applied"` when the
scope was applied, and for the file tree `childCounts`, `sizes`, `ancestors`
and `truncated`. Exports, select-all and scoped views page through `list` with
the same query until `pageCount` or `totalCount` is reached; without either,
a short page ends the collection, and an empty page before the end, a failed
page or more than 1,000 pages is an error rather than a partial result.

```ts
// Server side (API route, server action…): one function per table.
import { compatibleListParams } from "@/components/ui/yayaw-table/utils/table-contracts";

export async function listProjects(input: Record<string, unknown>) {
  const user = await requireUser(); // from the session
  const params = compatibleListParams(input); // both naming conventions, active rules only
  const where = [projectsVisibleTo(user)];
  if (params.search) where.push(matchesSearch(String(params.search)));
  where.push(...columnFilterClauses(params.filters));
  const rules = (params.advancedFilters as Rule[]).map(ruleClause);
  if (rules.length) where.push(params.advancedFilterJoin === "or" ? or(rules) : and(rules));
  where.push(...((input.requiredFilters as Rule[] | undefined) ?? []).map(ruleClause));
  if (input.scope) where.push(scopeClause(input.scope)); // then answer meta.scope: "applied"
  const { rows, total } = await queryProjects({ where, sorting: params.sorting, page: Number(params.page), pageSize: Number(params.pageSize) });
  return {
    data: rows.map(toRawRow), // numbers as numbers, dates as ISO or YYYY-MM-DD
    meta: { totalCount: total, pageCount: Math.ceil(total / Number(params.pageSize)), ...(input.scope ? { scope: "applied" } : {}) },
  };
}
```

### Filter operators

Rules carry `values` (an array, or one value). The server must understand
every operator the editions can send; mirror `matchesContractFilter()`:

<!-- skill-check: filter-operators -->
| Operator | Types | Meaning |
| --- | --- | --- |
| `contains`, `notContains` | text, multi-select | Text contains `values[0]` (case-insensitive); a list contains any of `values` |
| `startsWith`, `endsWith` | text | Prefix, suffix (case-insensitive) |
| `equals`, `notEquals` | text, number, date, select | Equality; dates compare whole local days |
| `is`, `isNot` | select (text: case-insensitive) | Equality of option values |
| `isAnyOf`, `in` | select | One of `values` |
| `isNoneOf`, `notIn` | select | None of `values` |
| `containsAll`, `containsNone` | multi-select | Every or none of `values` |
| `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | number, date | Compared with `values[0]`; dates by local day |
| `between` | number, date | Inclusive `values[0]` to `values[1]`; dates cover whole days |
| `before`, `after` | date | Strictly before or after the day |
| `isEmpty`, `isNotEmpty` | every type | `null`, `""` or `[]` |
| `isTrue`, `isFalse` | boolean | From chart clicks and boolean filters |
| `withinDistance` | location | `values: [lat, lng, km]`, great-circle distance |
| `withinBounds` | location | `values: [west, south, east, north]`; `west > east` crosses the antimeridian |

A rule without its values matches every row. Date-only values are local
calendar days, not UTC midnights.

## `aggregate`

Receives the query (`search`, `filters`, `advancedFilters`,
`advancedFilterJoin`, `requiredFilters` from dashboards), `locale`, and either:

- `calculations: { [columnId]: CalculationType }` for footer calculations
  (`count_all`, `count_values`, `count_unique`, `count_empty`,
  `count_not_empty`, `count_true`, `count_false`, `percent_empty`,
  `percent_not_empty`, `percent_true`, `percent_false`, `sum`, `average`,
  `median`, `min`, `max`, `range`): answer `{ results: { [columnId]: { raw,
  label } } }`; a `label` shows as is, a plain value (or `raw` alone) in the
  column's format;
- or, for charts, `groupBy: [{ columnId, bucket? }]` (one or two levels),
  `metrics: [{ fn, columnId? }]` (`count`, `sum`, `avg`, `min`, `max`,
  `countDistinct`), `timeZone` and `weekStartsOn`, with empty `calculations`:
  answer `{ groups: [{ keys, values }], truncated? }`. Keys follow `groupBy`:
  `null` for empty values, `YYYY-MM-DD` days, the first day of a week,
  `YYYY-MM` months, `YYYY-Qn` quarters, `YYYY` years; a multi-select value
  counts in each of its groups. Values follow `metrics`.

Without `aggregate`, when it throws, or when a chart gets no `groups`, the
table loads the matching rows through `list` (every page for footer
calculations, at most 2,000 rows for a chart) and computes in the browser.
`aggregateChartRows()` is the reference implementation of chart groups.

## Mutations

| Action | Call | Answer and notes |
| --- | --- | --- |
| `create` | `(values)` | `{ success, data?: row, error?, fieldErrors? }`; return the created row with its id. |
| `update` | `(id, patch, context?)` | `context.row` is the row as displayed (version fields included): use it for optimistic concurrency checks, never as trusted data. Inline edits send one field; `submitMode: "patch"` forms send changed fields only. |
| `delete` | `(id, context?)` | Deleting the last row of the last page makes the table step back a page. |
| `duplicate` | `(id)` | Return the copy in `data`; Ctrl/Cmd+D selects returned copies. |
| `bulkUpdate` | `(ids, patch)` | Only the fields added in the bulk editor. On partial failure return `failedIds`: the complete subset still to update. |
| `bulkDelete` | `(ids)` | Same `failedIds` rule. Without it the table calls `delete` per row. |
| `bulkCopy` | `(ids)` | Bulk Copy when there is no `onBulkCopy`; the table refreshes after a success. React up to 3.6.1 never called it. |
| `reorder` | `({ viewId, id, previousId?, nextId? }, { row })` | Store one order per view; never modify records. `{ success, error? }`. |

## Saved views

<!-- skill-check: actions.views -->
| Action | Call and answer |
| --- | --- |
| `actions.views.list` | `({ tableId, tableType })` → `{ success: true, data: TableView[] }` (React reads `data`; Vue also accepts a bare array) |
| `actions.views.create` | `({ tableId, tableType, name, config, isGlobal?, isDefault? })` → `{ success, data: view }` |
| `actions.views.update` | `(id, { tableId, tableType, name?, config?, isGlobal? })` → `{ success, data: view }` |
| `actions.views.delete` | `(id, { tableId, tableType })` → `{ success }` |
| `actions.views.getFavorite` | `({ tableId, tableType })` → `{ success: true, data: { viewId } }` (`null` for none) |
| `actions.views.setFavorite` | `(viewId \| null, { tableId, tableType })` → `{ success: true, data: { viewId } }` |

Provide all four CRUD handlers (omitted ones fall back to `localStorage`) and
both favorite handlers or neither. The server lists only system views, the
user's own views and views shared in the user's organization; sets the owner
from the session; checks the right to share before accepting `isGlobal:
true`; checks ownership or an editor role on update and delete; protects
`isSystem` views; stores favorites per user, organization, table type and
table id, and clears them when a view is deleted. Resolve `canEdit` and
`canDelete` per view for the interface.

## File tree

<!-- skill-check: actions.tree -->
| Action | Call | Without it |
| --- | --- | --- |
| `actions.tree.path` | `(id)` → ancestors, root first (breadcrumbs, deep links) | Walks the parent column of loaded rows |
| `actions.tree.move` | `({ ids, parentId, beforeId? })` → `{ moved?, failed?: [{ id, error? }] }`; re-check permissions, cycles and name clashes | `update` of the parent column per record |
| `actions.tree.createFolder` | `({ parentId, name })` → the folder row | `create` with the kind column set to `"folder"` |

List scopes: `children` (a folder's direct children, 200 per page, answer
`totalCount` and optionally `childCounts` and `sizes`), `subtree` (every
descendant for "Expand all"; set `meta.truncated` when you cap) and
`tree-matches` (search results plus `meta.ancestors`). Folder deletion policy
(recursive, refuse, move children up) is the host's.

## Gantt planning

<!-- skill-check: actions.planning -->
| Action | Call | Answer |
| --- | --- | --- |
| `actions.planning.load` | `({ scopeId, sourceId, cursor?, signal? })` | A `PlanningSnapshot` page: one `revision`, sources, calendars, tasks, dependencies, `nextCursor` until `complete: true` |
| `actions.planning.preview` | `({ scopeId, sourceId, revision, mutations })` | `{ success: true, data: { id, revision, changes, dependencies, warnings } }`; no business writes |
| `actions.planning.apply` | `({ scopeId, sourceId, previewId, revision, idempotencyKey })` | The complete snapshot after one transaction, or `code: "stale-preview"` |

Keep proposals server-side behind the preview id (the client cannot swap
changes), honour the idempotency key, re-check permissions at apply. Contract
and memory adapter (`createMemoryPlanningAdapter()`):
[planning adapters](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/PLANNING-ADAPTERS.md).

## Import

Data › Import appears when rows can be created or updated (`table.import:
false` hides it). The browser parses CSV, maps columns and converts values
(decimal commas, currencies, percents, day-first or month-first dates, yes/no,
option labels) before writing; the server still validates everything.

<!-- skill-check: actions.import -->
| Member | Contract |
| --- | --- |
| `actions.import.csv` | `false` hides CSV files and pasted text. |
| `actions.import.sources` | `[{ id, label, description?, load(context) }]`; `load` answers `{ headers, rows }` or `{ text }`. |
| `actions.import.importRows` | `({ creates: [{ rowIndex, values }], updates: [{ rowIndex, id, values }] }, context)` → `{ created?, updated?, failures?: [{ rowIndex, message? }] }`. Preferred over `create`/`update` row by row. |
| `actions.import.lookup` | `({ columnId, keys })` → `{ [key]: recordId }`, to match existing records; default: every row loaded through `list`. |
| `actions.import.allowNewOptions` | Keep unknown select choices instead of reporting them. |
| `actions.import.batchSize` | Rows per write (50). |

A 401/403 response or an `unauthorized`, `forbidden` or
`invalid_credentials` error stops the import; other failures are reported per
row. Addresses in `location` columns are geocoded with `actions.geocode`
before planning.

## Export

`actions.exportFile(request)` builds files on the server. The request is
`{ format: "csv" | "xlsx" | "pdf", scope: "view" | "selection", formatted,
fileName, viewId, query, columns, selectedRowIds, locale? }`, where each
column is `{ id, header }` plus what the table shows it with, when set:
`type`, `typeKey`, `options`, `numberFormat`, `dateDisplayPreset`,
`dateFormat`, `timeZone`, `hour12`. Answer `{ url }`, `{ blob }` or nothing.
Load the rows yourself from `query` with the user's permissions (limit to
`selectedRowIds` for a selection), write `formatted` values with each
column's format in `locale`, or the stored values otherwise.
Excel is offered only with `exportFile`; `table.exportFormats` narrows the
formats. Without it, the browser writes a UTF-8 CSV or prints a PDF from rows
loaded through `list`, and `onExport` can replace the CSV file.

## Geocoding

`actions.geocode(query, { locale, signal })` → `[{ lat, lng, label, address? }]`,
best first (eight shown), called after 300 ms and three characters, the
previous call aborted through `signal`. Call your provider on your server
with its key; the library ships no geocoder.

## Public form links

<!-- skill-check: actions.formLinks -->
| Action | Call and answer |
| --- | --- |
| `actions.formLinks.status` | `(viewId)` → `{ published, url?, acceptsResponses? }` or `null` |
| `actions.formLinks.publish` | `(viewId, snapshot?)` → `{ url }`: build the snapshot on the server from the saved view with `buildPublicFormSnapshot()`; ignore the deprecated browser `snapshot` |
| `actions.formLinks.unpublish` | `(viewId)` |
| `actions.formLinks.setAcceptingResponses` | `(viewId, accepting)` |

Serving the public page and accepting responses: [forms](forms.md).

## Destinations, connectors and schedules

`actions.destinations` lists rows of the Data menu. A destination:

<!-- skill-check: destination -->
| Field | Meaning |
| --- | --- |
| `destination.id`, `destination.label` | Identity (the first destination with an id wins) and name. |
| `destination.kind` | `"connect"` (also `"sync"`, `"export"`) lists it under Connect; `"share"` under Share, after "Copy link". |
| `destination.icon` | React node or Vue component; a send icon by default. |
| `destination.hidden`, `destination.requiresSelection` | Hide it, or offer it only while rows are selected. |
| `destination.run` | `(context)` → `{ message? }`. Context: `tableId`, `tableType`, `viewId`, `query` (the `list` shape), visible `columns`, `selectedRowIds`, `url`, `loadRows`. Prefer sending `query` and `viewId` to your server over `loadRows` rows from the browser. |
| `destination.schedule` | Scheduling for this view (below). |
| `destination.connector` | Opens the connector screen instead of `run` (below). |

A connector (`DataDestinationConnector`, in `connector-flow.ts`) is what the
host declares for a target such as a Notion database or a spreadsheet. Every
function runs host code; do the work on the server.

<!-- skill-check: connector -->
| Member | Contract |
| --- | --- |
| `connector.targets` | `(context)` → `[{ id, label, description?, children? }]`: targets this user may use (a spreadsheet's tabs as children). |
| `connector.allowTargetInput` | `{ label, placeholder?, resolve(input, context) }` for a pasted link. |
| `connector.describe` | `({ targetId, childId? }, context)` → `{ provider?, fields: [{ name, id?, type?, options?, index? }], keyFields?, allowNewFields? }`. |
| `connector.modes` | `"upsert"` (default) and/or `"replace"`. |
| `connector.load`, `connector.save` | The view's settings: target, mapping (`{ columnId, field, fieldId?, fieldIndex? }`), key field, mode, direction, rules. |
| `connector.push` | `(settings, context)` → push result or `{ error: { code, details } }`; the context adds `scope`, the sent `columns` and, for a selection, `selectedRowIds` and `loadRows`. |
| `connector.directions` | Subset of `push` (default), `pull`, `two-way`; pull and two-way need `sync`. |
| `connector.conflictRules` | Subset of `table-wins`, `target-wins`, `latest-wins` (drop the last for targets without edit times). |
| `connector.preview` | Pull or two-way dry run → `toSyncPreview(plan)`. |
| `connector.sync` | Runs pull or two-way → `toSyncRunResult(result, plan)`; the table reloads. |
| `connector.conflicts` | Display-only rules applied by your code: `{ ownership, columnRules, lock, allowManual }`. |
| `connector.listConflicts`, `connector.resolveConflicts` | Conflicts left to a person, and their resolution. |
| `connector.checkSchema` | Server-side target check; by default the screen checks the `describe` fields. |
| `connector.prepareTarget` | `(fixes, settings, context)` applies fixable issues ("Prepare Notion database"). |
| `connector.createTarget` | `{ label?, parents?, create }`: "Create one from this table's columns…". |
| `connector.labels` | `{ target?, child? }` names, such as "Spreadsheet" and "Tab". |
| `connector.help` | `{ notShared?, missingTarget? }` messages. |

Schedules are settings the table edits and the host runs:

<!-- skill-check: schedule -->
| Member | Contract |
| --- | --- |
| `schedule.frequencies` | Subset of `manual`, `auto`, `hourly`, `daily`, `weekly`, `monthly` (default all). |
| `schedule.load` | `(context)` → the view's `ScheduleSettings` or `null`. |
| `schedule.save` | `(settings, context)`: store per destination and view. |
| `schedule.status` | `(context)` → `{ lastRunAt?, lastResult?, message? }`. |

The host's worker computes due runs with `nextScheduleRun()` (time zones and
daylight saving included), re-checks that the owner may still use the
connection and the view, loads the rows on the server and records the result.
`table.schedule`, `table.connectors` and `table.sync` set to `false` hide
schedules, connector screens and pull or two-way directions. Server modules
and the sync engine: [connectors](connectors.md).

## Dashboards

`YayawDashboard` receives `actions={{ dashboards }}`:

<!-- skill-check: actions.dashboards -->
| Action | Call and answer |
| --- | --- |
| `actions.dashboards.list` | `()` → `[{ id, name }]` of the dashboards this user may open |
| `actions.dashboards.load` | `(id)` → the dashboard JSON (normalized and repaired on load) |
| `actions.dashboards.save` | `(dashboard)`, called by "Done" in edit mode |
| `actions.dashboards.remove` | `(id)` |

Authorize every call; `canEdit` only shows the editing controls. Widgets call
each table's own `list` and `aggregate` with `requiredFilters`.
