# Pitfalls

Each entry: what you see, why, what to do.

## Server contract

- **"Match any condition" shows the same rows as "all".** The server ignores
  `advancedFilterJoin`. OR the advanced rules when it is `"or"`; keep search,
  column filters, `requiredFilters` and the scope ANDed around them.
- **Date filters are a day off, or drop their last day.** The server reads
  date rule values as instants. They are `YYYY-MM-DD` days (`between`
  includes both): compare `date` fields with the day, and cover
  `[day start, next day start)` in a zone on timestamps. Views saved by older
  versions may still hold instants: pass them through
  `normalizeDateFilterRules(rules, { timeZone })` with the saver's zone (see
  [Date rules](server-contracts.md#date-rules)).
- **Dashboard filters do not narrow a widget.** The server ignores
  `requiredFilters`. AND them with everything, including a view whose own
  rules are joined with OR (the dashboard cannot express that in a flat list).
- **Charts say they are partial, footer totals are slow, on big tables.** No
  `aggregate`: charts compute over at most 2,000 loaded rows, and footer
  totals load every matching page first. Implement `aggregate` for both
  `calculations` and `groupBy`.
- **Calendar, map or file tree are slow or truncated.** The scope is ignored,
  so the table loads the query's rows (capped) and filters them itself. Apply
  `scope` and answer `meta.scope: "applied"`.
- **Pagination, select-all or exports stop early or fail.** `list` returns no
  `meta.totalCount`/`meta.pageCount`, or silently caps the page size. Always
  return the totals; a capped page size is fine when the totals are right.
- **Page 2 shows page 3.** `list` pages start at 1 (the URL index starts at
  0). Use `page`, `pageSize` as sent.
- **Kanban moves or calendar drags snap back.** `update` answered
  `success: false` or threw, `canEditRow` refused the row, or the lane column
  is not a select or tag column. Check the answer and the column type.
- **A page of grouped rows shows partial groups.** Grouping groups the rows of
  the current page. Use a chart (server `aggregate`) for totals.
- **Re-imports duplicate records.** No "Match existing records by" key; set
  one (an id or unique column) and implement `actions.import.lookup` for big
  tables, or the table loads every row through `list` to find keys.

## Values, formats and dates

- **Sorting, filters, totals or raw exports behave oddly.** The server sends
  formatted text ("1 234,50 €", "10/09/2026"). Send raw numbers and ISO dates;
  put `numberFormat` and date presets on the column: a format applies
  everywhere, and formatted versus raw exports are chosen by the user.
- **Dates one day early.** A date-only value stored or returned as UTC
  midnight (`2026-09-10T00:00:00Z`). Return `YYYY-MM-DD` for calendar days;
  set `timeZone` on columns of instants (presets and patterns follow it).
- **Numbers look different in React and Vue.** No `numberFormat`: React shows
  the raw value, Vue groups digits. Set `numberFormat`.
- **Exports do not look like the screen.** `exportFile` ignores `formatted`.
  When `formatted` is true, format with `request.columns` (type, options,
  number and date formats) in `request.locale`; write stored values
  otherwise.

## Setup and rendering

- **"Missing QueryClient" or "Duplicate QueryClient detected" (React).**
  Mount exactly one `QueryClientProvider`; pass `queryClient` only if it is
  that same client.
- **"nuqs requires an adapter" (React).** Mount a `NuqsAdapter` for your
  router, even with `syncUrl: false`.
- **Next.js: functions cannot be passed to Client Components.** A server
  component renders `DataTable` with `getTableActions`. Put the table in a
  `"use client"` component; its actions may call server actions.
- **Server-rendered markup ignores the URL, the saved view or the favorite.**
  URL state, views, favorites and the order of views (`localStorage`
  without `actions.views`) and measured page sizes exist only in the
  browser: the server renders the default state and the client applies the
  rest after hydration (React defers skeletons and drag handles to avoid
  mismatches; Vue reads the URL on mount).
  Keep view-dependent UI inside the table, and on statically rendered Next.js
  routes wrap the table in `<Suspense>` because the adapter reads search
  params.
- **`initialData` flickers, reorders or is ignored.** It stands only for the
  first request: page 1, the default page size, no search or filters, the
  order of `columns.sort`. React skips it as soon as any sort is in state,
  which since 3.6.1 includes a configured `columns.sort`; Vue shows it and
  then replaces it with the first `list` answer. Render that exact first page
  on the server (same order and size), pass `initialRowCount` and
  `initialPageCount`, or leave `initialData` out.
- **The table refetches in a loop, forms reset, the Gantt rebuilds.**
  `getTableActions`/`getTableConfig` or the objects they return change
  identity on every render. Define them at module level or memoize them.
- **Two tables of the same type share filters, cache or selection.** They
  share a `tableId`. Give each a `tableId` or `instanceId`; turn `syncUrl`
  off for secondary tables.
- **Labels show keys such as `actions.create` (React).** A partial
  `translations` object replaces the defaults. Spread `defaultTranslations`.
- **Type errors on `render` props after install (React).** The app uses a
  Radix-based shadcn style. The item needs a Base UI style (`base-*`).
- **"Global CSS cannot be imported" (Next.js Pages Router).** The table
  imports its stylesheets from components; use the App Router or a bundler
  that allows it.
- **A public form page without styles (Vue).** A page importing
  `YayawTableForm.vue` directly must import the Vue stylesheet itself.

## Modes

- **A mode is missing from the switcher.** Not in `displayModes`, disabled
  with `table.<mode>: false`, its renderer not passed (calendar, chart, map),
  no parent column (file tree), no `create` (form), or no start and end
  columns (Gantt). Links asking for it fall back silently.
- **The map is blank or grey.** No basemap: set `table.map.style`. With a
  strict CSP, self-host the worker: `table.map.workerUrl` must point to
  `maplibre-gl-worker.mjs` with `maplibre-gl-shared.mjs` in the same folder.
- **Feed bodies show HTML or markdown as text.** By design; render them with
  `table.feed.renderBody` and sanitize.
- **Excel is missing from Export.** Only offered with `actions.exportFile`.
- **Addresses fail to import into a `location` column.** Without
  `actions.geocode` only coordinates import; addresses become errors.
- **React's bulk Copy puts JSON on the clipboard.** Without `onBulkCopy` or
  `actions.bulkCopy`, React copies the selected rows as JSON; Vue hides Copy.
  Up to 3.6.1, React also ignored `actions.bulkCopy`.
- **Exhaustive `switch` or `Record` over `TableDisplayMode`, column types or
  operators stops compiling after an upgrade.** Unions grow in minor
  releases; add the new members.

## Views, forms and security

- **Saved views leak to other users or vanish on another device.** Only
  `actions.views.list` is implemented: the other handlers fall back to
  `localStorage`, and nothing scopes shared views. Implement all handlers and
  scope them by organization and owner on the server.
- **A tampered public form.** The host used the snapshot the browser passes
  to `formLinks.publish`. Build it on the server with
  `buildPublicFormSnapshot()` and check each response with
  `acceptPublicFormResponse()`.
- **A Form view asks record ids or timestamps.** Flag host-managed columns
  `system`, `readonly` or `computed` (or `form: false`), or declare the create
  form with `getFormConfig`: forms then ask only what people may write.
- **Selection jumps between records after paging.** Rows have positional
  ids. Pass `getRowId` returning stable record ids.
- **UI flags treated as permissions.** `allowEdit`, `canEditRow`,
  `allowViewSharing`, `canEdit`, `canDelete` and dashboard `canEdit` only hide
  controls. Enforce everything on the server.

## Connectors and installs

- **A sync writes twice or overwrites fresh data.** Two runs planned from the
  same state, or the state was not saved after a partial failure. Lock per
  destination and view, and always save `result.state`.
- **Rows pushed from the browser.** `run` or `push` used `loadRows` in the
  client. Load rows on the server from `query` and `viewId`.
- **A pinned install drifted to the latest core.** Optional items depend on
  the latest core URL; refuse overwrites of the core folder or restore it
  (see [install](install.md#pin-a-version-and-verify-it)).
- **Local patches disappeared after an upgrade.** Reinstalling overwrites the
  copied folders. Prefer extension points; record patches and re-apply them.
