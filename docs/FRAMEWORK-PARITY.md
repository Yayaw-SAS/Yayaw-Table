# React and Vue parity

The two registries remain independently installable. Their shared adapter lives in `src/components/ui/yayaw-table/utils/table-contracts.ts`; `bun run contracts:sync` copies it to the Vue source before registry generation. `tests/fixtures/parity.json` exercises both filtering implementations and both list contracts.

## Mutation row context

React and Vue pass an optional `TableMutationContext` to per-record persistence actions:
`update(id, patch, context)` and `delete(id, context)`. `context.row` contains the original
row, including host version fields, separately from the edited patch. Existing action
implementations accepting fewer arguments remain valid. Hosts must still validate
versions, permissions and fields on the server.

The context is forwarded by catalogue forms, inline editing, Kanban moves, row/detail
delete actions and per-row bulk-delete fallbacks. A host-provided bulk action keeps its
existing contract and remains responsible for carrying each selected record's version.
React action/form coverage and Vue inline/form/row action coverage verify the behavior.

## Release contract

React modules that declare a client boundary keep `"use client"` before imports,
including Gantt helpers in the URL-state hook. The registry must preserve the
directive prologue for Next.js consumers. `tests/client-directives.test.ts`
checks the source syntax before generation; the Yayaw consumer production build
checks the copied hook. Vue has no React client directive and retains the same
URL-state and saved-view behavior.

React and Vue are editions of the same product. A consumer-facing change is ready to merge only when both editions expose equivalent public contracts and observable outcomes, with equivalent regression coverage and no known functional gap. Framework primitives and internal component structure may differ when their behavior remains equivalent.

Both editions use TanStack Table 9.2.4 through framework-specific adapters with the same explicit feature, row-model, filter, sort, and aggregation registrations. The adapters preserve YaYaw's two-generic table types and `left`/`right` persisted pinning contract while translating to TanStack 9's internal `start`/`end` state. Existing saved views and table URLs therefore remain readable. TanStack 9 requires ESM and an ES2022 target. The Vue edition continues to require Vue `^3.5.0`; this migration does not expand the supported framework range.

Every parity-affecting PR must update this document and keep the Vue example at `packages/yayaw-table-vue/demo/App.vue` representative of the React example. Public API, behavior, default, setup, example, or migration changes also require matching English and French documentation in [`Yayaw-SAS/Yayaw`](https://github.com/Yayaw-SAS/Yayaw), including an exact protected seed transition for the database-backed documentation system.

## Actions and views

Both managers support one personal favorite per table, separate from shared view records. The star is available for saved system/shared views even with saving disabled. Arrival priority is explicit URL state, `initialActiveViewId`, an accessible favorite, then `isDefault`. A link with only `?view=<id>` applies that view's settings, and a view named by the link or by `initialActiveViewId` is applied once the saved views load, without waiting for `getFavorite`. Both editions read the incoming URL once on mount, so the table's own first URL writes (React's `<tableId>-order`) never cancel it (`tests/table-view-favorite.test.tsx`, `saved-views.test.ts`, `e2e/views.spec.ts`). Optional `getFavorite`/`setFavorite` actions synchronize preferences; otherwise persistence is browser-local. Organization scoping and permissions remain the host's responsibility; see [saved views](SAVED-VIEWS.md).

List actions receive both naming conventions:

| Value | Accepted/emitted names |
| --- | --- |
| Page | `page`, starting at **1** |
| Page size | `limit` and `pageSize` |
| Sort | `orderBy` object and `sorting` array, preserving every sort |
| Search | `search`, `q`, and `globalSearch` |
| Column filters | `filters` object |
| Advanced filters | Active `advancedFilters` array and `advancedFilterJoin` (`and`/`or`) |
| Scope (optional) | `scope`, for example `{ kind: "dateRange", field, endField?, from, to }` |

URL page indexes remain zero-based. Invalid page sizes fall back to defaults. Existing action handlers can keep reading their original names. Aggregation receives the filter join operator too. Both editions accept primitive aggregate results, shown in the column's format like the list fallback, and `{ raw, label }` values, whose label is shown as given.

Advanced filter input accepts either an array or `{ filters, joinOperator }`. Inactive rules do not filter rows. An OR envelope retains its join when converted to an array. The local engines understand both select operator families: `is`/`isNot`/`isAnyOf`/`isNoneOf` and `equals`/`notEquals`/`in`/`notIn`, plus multi-select membership operators. Date rules compare whole calendar days and carry `YYYY-MM-DD` values (see [Date filter values](#date-filter-values)). Remote handlers remain responsible for applying the supplied filters and join operator.

Saved views accept canonical `globalSearch`, `columnFilters`, and `columnPinning`, as well as Vue's earlier `search`, `filters`, and `pinning`. Canonical values take precedence when both are present. Legacy Kanban grouping is migrated to `grouping`. Vue applies a default view when there is no requested view or explicit table URL state, protects system views from update/deletion in the UI, indicates modified views, and preserves drafts when persistence fails.

Saved snapshots now include the effective `density` (XS through 2XL). Applying or resetting a legacy view without density restores the configured table default. Both editions load persisted views on mount when no initial views are provided, including after a full reload. Density participates in dirty detection; it remains local until a view is saved and is not an independent URL parameter.

React ignores repeated writes of equivalent table state in both URL and memory modes, preventing column-order synchronization from retriggering subscribers during an action refresh.

The Create button is the final toolbar action and keeps the primary style, in text and icon modes. Built-in secondary actions remain outlined. Existing custom placement values remain accepted: `before-create` and `between-create-export` put custom actions before Export; `after-export` puts them after Export. Create follows all of these groups.

Vue Kanban and Gallery controls use Reka UI Select, DropdownMenu, and Checkbox primitives with the same Shadcn-style tokens as the existing menus. This includes card page-size selection and Lucide icons for lane movement. Keyboard navigation, multi-choice property menus, focus restoration, disabled card selection, translated labels, and saved card options have regression coverage. The public configuration and saved-view formats are unchanged.

## View reports

React `DataTable` takes `onViewConfigChange(config)`; Vue `YayawDataTable`
emits `view-config-change` and exposes `getViewConfig()`. Both report the
table's view when it starts and after each change (sort, filters, search,
columns, grouping, density, display mode, a mode's settings, page size),
once per distinct view; `ToolbarActionContext.getViewConfig()` gives the
same to toolbar actions in both editions. The config is
`canonicalViewConfig()` from the shared `view-config.ts`: sanitized like
`sanitizeViewConfig`, without the `select` and `actions` columns the table
adds itself, empty maps left out, keys in one order, so equal views give
equal JSON. React reads it from the URL-state snapshot resolved with the
table's defaults, as the view manager does (`useCurrentViewConfig`;
`tableViewDefaults` and `resolveTableViewConfig` in `table-view-state.ts`,
now shared by the toolbar and the view manager); Vue from its state snapshot.
The screen editor's view editor and full-page tables read it.

Verification: `tests/fixtures/view-config-change.json` drives
`tests/table-instances.test.tsx` and
`packages/yayaw-table-vue/src/components/table-instances.test.ts`: the same
table reports the same configs in both editions when it starts, after a sort
and after a search. `tests/view-config-suite.ts` covers
`canonicalViewConfig`.

## Shift-click row selection

React and Vue table row checkboxes select or clear an inclusive range when
`enableRowSelection` and `enableMultiRowSelection` are enabled. The starting
point is the last normal checkbox toggle within the same table instance. A
Shift-click without an anchor, after the visible row order changes, or with
single selection enabled behaves as a normal toggle.

Both editions share the range helpers and use the current rendered page order,
skipping disabled rows, single-select rows, group headers, and collapsed rows.
Existing selections outside the range are retained. Header and group checkboxes
refresh their checked and indeterminate state after a range update. Gallery and
Kanban keep their existing individual selection controls; range selection does
not fetch additional server pages.

Equivalent React and Vue regression tests exercise inclusive select/deselect,
disabled rows, group collapse, single selection, header state, and isolated
instances. The runnable Vue example's row checkboxes support the same gesture.

## Catalogue forms

Modal and drawer forms share a 10% black backdrop with the React
`backdrop-blur-xs` blur in both editions. Vue uses the host's `--blur-xs` token
when available, with a standalone 4px fallback. Browsers without backdrop-filter
support retain the translucent backdrop. Visual verification covers the modal
and drawer presentations, keeping the form itself sharp.

React and Vue also expose `RecordDetails` and the table's `details` prop for
read-only consultation. Both support drawer/modal/inline presentation, the shared
typed projection, update metadata, confirmation before deletion, and append-only
audit undo through an application callback. Both examples share the same 30-field
campaign and mutation fixtures (`examples/record-details-react.tsx` and the Vue
`?example=record-details` view). See [Record details](RECORD-DETAILS.md).

Both editions can generate standard fields from column definitions when the catalogue has no matching form. Register a form to customize validation, conditional behavior, labels, or field rendering. Existing React TanStack Form instances, factories, custom field renderers, and custom collection editors remain supported.

`FormConfig.blocks` or `TableConfig.form.blocks` can compose generated fields without redefining them. Explicit form blocks take precedence over table blocks and legacy `sections`. Blocks support nested `section` containers with 1–3 columns, `field` references, escaped informational `content`, `actions`, and framework-native `custom` rendering. Each declared field appears once; unknown references are ignored and omitted fields are appended. `span: "full"` fills the parent grid; narrow form containers collapse to one column. Bulk editing uses its list of added properties and does not render these create/edit blocks.

Actions receive current values, `setFieldValue`, `validate`, `submit`, `disabled`, `isSubmitting`, and `isValidating`. `validate: true` validates without submitting before the callback. Pending actions block duplicate clicks, show failures inline, allow retry, and receive an `AbortSignal` when closed, disabled, hidden, or switched to another record. Custom React/Vue render callbacks receive the same context; Vue also forwards `form-{id}` slots through the table and nested sections. Form-local translation keys resolve before provider keys. No layout block adds values to the submission payload.

Equivalent regression tests exercise saved density, legacy defaults, block field deduplication, translation, validation, async retry/duplicate locking, and unmount cancellation. The Vue product demo and `examples/form-layout-react.tsx` share `examples/form-layout.ts` and demonstrate a live preview and a name-normalization action.

Both editions also support the declarative `tablePicker` field. It embeds a read-only table with local or server data, search, filters, sorting, pagination, saved views, and controlled single or multiple selection. Selection survives query changes, `parseValue` preserves typed IDs, and the nested table keeps its state out of the page URL unless `syncUrl: true` is explicit.

The following React configuration illustrates the shared form features:

```ts
import { z } from "zod";
import type { FormConfig } from "@/components/ui/yayaw-table/components/forms/types";

const productForm: FormConfig = {
  id: "product",
  title: "Edit product",
  presentation: "modal", // "drawer" is also supported
  width: "48rem",
  submitMode: "patch",
  fields: [
    { name: "name", label: "Name", type: "text", schema: z.string().min(1) },
    { name: "active", label: "Active", type: "switch" },
    {
      name: "reason", label: "Reason", type: "text",
      hidden: ({ values }) => values?.active !== false,
    },
    {
      name: "lines", label: "Lines", type: "collection",
      collectionMode: "inline", // "dialog" is the React default
      itemFields: [
        { name: "label", label: "Label", type: "text", required: true },
        { name: "quantity", label: "Quantity", type: "number", min: 0 },
      ],
    },
  ],
};
```

Fields support `hidden` and `disabled` booleans or context predicates, `defaultValue`, field `schema`, and section layouts. The context includes `formType`, `tableId`, `tableType`, `mode` (`create`/`edit`), `row`, `initialData`, and current `values`. Runtime controls also receive `setFieldValue`.

`loadInitialValues(row, context, signal)` loads additional values before editing. Closing, reopening, changing the row/form identity, or retrying cancels the previous request; late responses are ignored. A failure remains visible and can be retried.

Select-like fields support:

- Static `options` or `options(context)` returning a promise.
- `searchOptions(query, context, signal)`, with `searchMinLength` and `searchDebounceMs`.
- `resolveOptions(values, context, signal)` to hydrate labels for existing selections.
- `createOption(label, context, signal)` to add and select an option.
- `optionDependencies` and `optionsScope` to declare when options should reload. Unrelated edits do not reload the option list. Include tenant or authorization scope in `optionsScope` when applicable.

Nested collections validate item fields recursively. Errors include the item path and block submission. Field schemas run before the optional form schema. The validated result is passed through `transform(values, context)` before the action. In edit mode, `submitMode: "patch"` keeps only changes relative to the loaded initial values. Hidden and disabled fields are omitted. Explicit `false`, `0`, empty strings, empty arrays, and `null` are preserved; the schema can reject them when needed. Action `fieldErrors` remain attached to the form after failure.

## Bulk editing

When `onBulkEdit` is absent, `actions.bulkUpdate(ids, patch)` opens the catalogue bulk editor in both frameworks. A supplied callback keeps precedence. The editor captures the selected IDs, starts with values common to all targets, and applies only added fields. It uses each row's edit permission and conditional field rules. Reserved identity/timestamp fields and fields with `bulkEdit: false` are excluded. Rows resolving to different form types cannot share an editor.

`context.bulkEdit` exposes `ids`, `rows`, and added `fields`. Field and collection validation still applies, while the full-row schema is omitted because untouched required fields need not exist in a patch. A form transform receives the patch containing those added fields.

Return `{ success: false, failedIds: ["remaining-id"], error: "..." }` for a partial failure. `failedIds` must be the complete subset still requiring an update. Successful targets are removed from the selection, and retry sends only the remaining IDs with the retained draft. A failure without `failedIds` retains every target. Invalid completion reports never silently clear targets.

The catalogue bulk editor starts with no prepared fields. Both editions use a searchable Add a field picker, flat rows with the existing field editors, and per-field removal. Only added and currently editable fields are sent. Optional clear actions use shared type conventions and pass the field schema before being offered; boolean values remain explicit switches. Draft validation disables Apply to N rows until valid. The target count shrinks after partial success while the added fields and draft survive. The shared record presentation defaults to a right drawer on desktop and mobile, with a footer outside the scrolling body. Existing onBulkEdit precedence, permissions, transforms and Vue's opt-in JSON mode remain intact. Shared bulk-editor fixtures cover clear values; integration tests and real-browser flows cover addition, search, removal, validation, explicit clearing, target isolation and retries.

React resolves persistent entity IDs separately from table selection IDs. Positional row IDs are never sent in place of existing record IDs, and partial successes clear only the corresponding selected rows.

## Inline selection dismissal

React and Vue inline multi-selects use removable chips, search in the same field,
and anchored listboxes with checkmarks and keyboard navigation. The editor height
follows the table density. Toolbar and saved-view buttons use regular font weight. Options do
not expand the table row, disabled options cannot be toggled, and clearing all
choices submits an empty array. Selections retain their configured primitive types.
Outside interaction or focus leaving the editor flushes the current draft and
closes only after acknowledgement. A close requested during autosave waits for
that save; validation and transport failures retain the draft for correction or
retry. Escape cancels changes that have not been submitted. An in-flight write
cannot be undone by Escape. Unchanged dismissal does not issue an update.
`showDelayIndicator` displays the same thin debounce progress bar in both editions
and keeps it visible while saving, with reduced-motion support. Arrow keys
highlight options, Enter toggles the highlighted option or commits when none is
highlighted, and Backspace removes the last enabled chip when search is empty.

The Vue product demo now includes an editable Tags column. Regression coverage
includes portalled Vue choices, filtering, primitive IDs, empty selections,
focus dismissal, autosave/blur races, failure/retry and Escape. React runtime
coverage also exercises same-event change/dismissal, overlapping close requests
and a newer draft arriving during an in-flight write.

## Cards, inline editing, and reset

Vue gallery and Kanban use the same pagination state as the table. Local rows are filtered and sorted before slicing, using natural text ordering and type-aware number/date comparisons that match the table; server pages are not sliced twice. Kanban grouping follows toolbar grouping, configured lanes apply only to their configured field, and rejected updates restore the previous lane. Card properties use the column renderer, and image cells accept HTTP(S), relative paths, blob URLs, and supported image data URLs.

React inline editing resolves the catalogue for each row and honors hidden/disabled predicates, row permissions, asynchronous field validation, and schema transforms. Collections, custom fields, and remote pickers use the full catalogue editor.

Vue inline editing honors the column/table `debounceMs`, validates against the catalogue, cancels unsaved timers on Escape/unmount, and keeps errors available for correction. `allowInlineEdit` now defaults to `true` in both editions; actual cell editing remains opt-in through table or column `inlineEdit.enabled`.

Use **`showClearFilters: true` in either framework** to clear search, column filters, advanced filters, and pagination while preserving sorting, grouping, column visibility/order/pinning, page size, display mode, and the selected view. The historical `showResetFilters` option remains a supported alias and invokes this same behavior in both editions. The separate **Reset view** command lives in the view menu in both editions and restores the saved snapshot, or the initial application configuration for a temporary view.

Both editions distinguish the column drag-and-drop feature gate from the user's preference. Set `enableColumnDnd: false` to remove the controls and disable reordering. `enableColumnDragDropByDefault` supplies the initial preference and now defaults to `false` in both editions; users can toggle it from a column menu or the Vue Properties panel, and the choice is stored per table. Vue column headers include a keyboard drag handle. Vue Kanban cards expose previous/next lane controls alongside pointer dragging, matching the keyboard outcome provided by React's drag system.

Set `enableColumnResizing: true` to expose resize handles on data columns. Pointer and touch dragging update widths continuously; keyboard users can focus a handle and use Left/Right Arrow in 10-pixel steps, Home for the minimum, and End for the maximum. Double-clicking a handle restores its configured size. Set `enableResizing: false` on an individual column to keep it fixed. Selection and actions columns are always fixed. Valid widths are stored in `columnSizing`, restored by saved views, and included in shareable table URLs. The feature defaults to `false` in both editions so existing layouts remain unchanged.

Both editions compose Shadcn Empty for table, Kanban, and Gallery. Search, column filters, or active advanced rules produce a filtered-empty message and a Clear filters action, regardless of toolbar reset flags or visibility. The action clears filtering inputs, returns to page one, and preserves sorting, grouping, column layout, display mode, page size, and the selected view without persisting its draft. Unfiltered empty data has no reset action; inactive advanced rules do not count as active filters. Custom empty-state copy and `show: false` apply to every mode, and loading/error states suppress the empty message. Shared `tests/fixtures/empty-states.json` scenarios and React/Vue integration tests cover these outcomes, URL isolation, and recovery after clearing filters. React installs the `empty` registry dependency; Vue ships the adapted Empty composition with its standalone CSS tokens.

Column header menus expose the same outcomes: ascending/descending sort, filter this column, pin left/right, unpin, hide, and the persistent reordering preference when each capability is enabled. Table, gallery, and Kanban render the configured empty state, and pagination is hidden when all rows fit on one page.

## Export, selection, and refresh

Toolbar export retrieves **all matching rows**, respecting the current search, column filters, advanced-filter join, and sort. Vue applies the same query to local data before export. Server export and select-all use the shared page collector; a server page-size cap does not truncate results when `meta.pageCount` or `meta.totalCount` describes the full result. Without metadata, a short page ends the collection. An inconsistent empty page, a failed request, or the 1,000-page limit reports an error instead of handing partial rows to the export callback. An export already in progress keeps the query and column order captured when it started; its button stays disabled until completion.

CSV export includes visible data columns in display order. Bulk export includes only selected rows. The `onExport` and `onBulkExport` callbacks retain their existing signatures and take precedence over the built-in download.

Both editions retain selected records across page and page-size changes. Deselecting one row keeps the other selected rows, including rows outside the current page. Returning to a page replaces cached selected records with the freshly loaded versions. Changing search, filters, sort, or grouping clears the selection by default; set `preserveSelectionOnQuery: true` to retain it in either edition. Both tables accept controlled row-selection state. A delayed select-all result cannot replace a newer selection or query, and select-all respects row selection permissions. Provide stable row IDs (or `getRowId`) for server pagination; positional indexes cannot identify records across pages. Off-page selected rows retain their last loaded values until fetched again.

Vue refreshes the active list after built-in mutations and table query invalidation. Invalidating an aggregate or an older cached page does not reload the visible list. If a deletion removes the last server page, the table requests the preceding valid page; local data shrinkage also clamps pagination. Consumer-owned action callbacks remain responsible for their own persistence and follow-up refresh unless their documented result explicitly requests library handling.

## Filter editing and keyboard interactions

Vue advanced filters use the same operator families as React. A new rule starts inactive; changing the column resets its data type, operator, and values. Numeric/date ranges expose two inputs. Select and multi-select rules preserve multiple primitive values, including numeric zero and boolean false. Existing Vue operator aliases remain editable when loaded from saved views or URLs. Apply validates and commits the draft; Escape restores the last applied rule. Rules can be disabled without removing their values.

Filter controls use the React `filters.*` translation keys, with English and French defaults. Table feedback and reusable field/collection controls inherit the table translations; standalone fields retain their English fallbacks. Date-only values from native inputs represent a local calendar date in both editions, including time zones west of UTC. The Options panel and row menus move focus when opened and restore it on dismissal. Row menus support arrow keys, skip disabled actions, and use a modal confirmation with trapped focus for deletion. A failed deletion retains its confirmation for retry.

## Date filter values

Date rules compare whole days, so both editions write, store and send their
values as calendar days, `YYYY-MM-DD`: one day, or `[first, last]` for
`between` (ordered, both days included), for date and timestamp columns
alike. Every filter date picker is day-granular: React's calendar (single or
range) and its Today, Yesterday, Last 7 days, Last 30 days and This month
shortcuts, and Vue's native date inputs. No filter offers a time, so every
date operator (`equals`, `notEquals`, `before`, `after`, `between`, and the
older `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`
aliases) carries days. Chart clicks (`between` over the bucket's first and
last days) and dashboard filters already wrote days; the calendar sends its
visible range as a `dateRange` scope of days, not as rules.

Older links, saved views and React presets could hold instants at the viewer's
local midnight, such as `2026-09-24T22:00:00.000Z` for 25 September in Paris.
Both editions read them as the viewer's days whenever rules enter the table
state: when they read a URL, apply a view (React's `seedTableViewState`
included) or a preset, or commit a rule from the editor; chart clicks add
days. The saved-view comparison reads both sides the same way, so an older
view is not marked modified, and dashboard KPIs normalize the rules of the
view they query (`dashboardViewParams`). A rule keeps its shape (one value or
a list); values that are not dates stay for the editor's validation. The
shared `date-filter-days.ts` holds the one implementation (`calendarDay`,
`dateFilterDays`, `normalizeDateFilterRules`), and `matchesContractFilter`
compares the record's day in the viewer's zone with the rule's days for Vue's
local data and every client fallback; React's `clientFilterFunctions.date` now
delegates to it.

React's range shortcuts live in its date popover; Vue's native inputs have no
shortcuts. This framework-native difference predates the calendar-day values
and does not change the rules either edition writes.

Coverage: the shared `tests/date-filter-days-suite.ts`, run by both runners
(days, wall-clock times and instants, older instants from Europe/Paris and
America/New_York viewers, `between` bounds in either order, each day operator,
each edition's URL reading and saved-view application, chart buckets and
calendar ranges); React `tests/date-filter-picker.test.tsx` and the URL and
view-state tests; Vue `components/filters/advanced-filters.test.ts`; and the
Playwright `e2e/date-filter.spec.ts`, which picks a range from the column
filter and opens an older link in both editions and both zones.

## Behavioral parity matrix

The parity contract covers user-visible behavior and serializable catalogue/action contracts. Component names, framework primitives, DOM structure, slots, and framework-native escape hatches remain specific to React or Vue.

| Surface | Shared behavior | Regression evidence |
| --- | --- | --- |
| Defaults and feature gates | Common defaults for editing, filters, column DnD/pinning, grouping, pagination, selection, views, debounce, URL state, and page sizes | Shared `behavior-defaults.json`, executed by both test runners |
| List/filter/view contracts | One-based action pages, both page-size/search aliases, multi-sort, simple and advanced filters, aggregate labels, normalized saved views | Shared `parity.json`; both `contracts-parity.test.ts` suites; view-state suites |
| Date filter values | `YYYY-MM-DD` days in requests, URLs and views; older instants read as the viewer's days; inclusive `between` | Shared `date-filter-days-suite.ts`; React `date-filter-picker.test.tsx`; Vue `advanced-filters.test.ts`; Playwright `e2e/date-filter.spec.ts` |
| Toolbar | Create/export order, icon mode, callback/static custom actions, action context, three placements, clear-filter shortcut | Vue `yayaw-data-table.test.ts`, `filter-reset.test.ts`; React toolbar and filter-reset suites |
| View manager | Default/system views, dirty state, create/update/delete/share permissions, recoverable persistence | Vue saved-view suites; React view-manager suites |
| Columns | Sort/filter/pin/hide menus, mandatory/utility locks, persistent DnD preference, pointer and keyboard reorder, optional resizing stored in views/URLs | Shared contract/view-state suites; Vue `catalogue-controls.test.ts`, `yayaw-data-table.test.ts`; React column and URL-state suites |
| Display modes | Shared mode registry, fallback for unavailable modes, grouping and pagination, card renderers, configurable empty state, one-page pagination hiding | Shared `display-modes.test.ts`; Playwright `e2e/views.spec.ts` in both editions; Vue `parity.test.ts`; React gallery/Kanban suites |
| Kanban updates | Permission-aware moves, optimistic update, rollback and accessible non-pointer movement | Vue `parity.test.ts`; React Kanban suites |
| Selection | Controlled state, cross-page cache, select-all race protection, optional query persistence | React `selection-parity.test.tsx`; Vue component/action suites |
| Catalogue forms | Generated fields, conditions, async values/options, nested collections, validation, transforms, patch mode | Shared `form-scenarios.json`; both form-contract suites and mounted form suites |
| Table picker | Local/server query, controlled single/multiple selection, typed IDs, isolated URL state | React `table-picker-parity.test.tsx` and picker unit tests; Vue form-component tests |
| Bulk actions | Permissions, catalogue editing, frozen targets, partial failure retry, callback precedence | Shared bulk fixtures; React form/bulk suites; Vue bulk suites |
| Inline editing | Catalogue validation, debounce, cancellation, permissions, optimistic rollback | React inline-form suites; Vue inline-edit suites |
| Export and refresh | All matching pages, current query/order, partial-result protection, mutation refresh/clamping | Shared paginated fixtures; both action suites |
| Accessibility and i18n | Translated controls, menu/dialog focus, row activation, column/Kanban keyboard alternatives | Vue keyboard suites; React mounted interaction suites |
| URL state | Compatible query keys when enabled; isolated in-memory state when disabled | React `url-sync-parity.test.tsx`; Vue state/catalogue-control suites |
| Distribution | TanStack Table 9.2.4 with matched explicit features, generated React and Vue registries, and the repository Vue example | Adapter compatibility tests, type checks, full tests, Vue builds, registry sync/pages build |

## Verification and distribution

`bun run e2e` runs `e2e/*.spec.ts` with Playwright against the React preview
(`examples/record-presentation-preview`) and the Vue demo, both on
`?example=views`, which render the same `examples/views.ts` records. Each spec
runs once per edition, so an observable difference fails one project.

`bun run test` registers all React tests through `bun:test` and preloads a browser environment for mounted form tests. `bun run vue:test` covers Vue and the shared fixtures. Run type checks, the Vue build, `registry:sync`, and `registry:pages` before publishing copied code. React test files are excluded from consumer registry output. Immutable released snapshots are unchanged by a feature PR.

Both toolbars offer XS, S, M, L, XL, and 2XL density via `extra-small`, `small`, `medium`, `large`, `extra-large`, and `extra-extra-large`. Shared Tailwind spacing factors target 28, 32, 40, 48, 56, and 64px rows before borders, coordinating cell padding, controls, and thumbnails. XS retains the old S appearance; typography stays unchanged and content may expand rows. Shared density fixtures and interaction tests cover the scale, isolated selection, configured defaults, and display-mode round trips.

Density, saved-view, toolbar-action, and row-action controls use styled tooltips on hover and keyboard focus, with translated labels and composed menu triggers. The host controls translations; Vue includes French defaults and the companion Yayaw example localizes its React labels. UI choices remain scoped to the table without affecting saved views or URL state.

## Data types

`TABLE_DATA_TYPES` in the shared contract is the source for generated form fields, inline editor selection and filter defaults. `tests/fixtures/data-types.json` enumerates every public type; `tests/data-types-parity.test.ts` verifies both runtimes, and React/Vue component tests verify the actual controls and invalid JSON correction flow.

| Type | Generated form / inline editor | Filter family |
| --- | --- | --- |
| text, string | text / text | text |
| code | textarea / textarea | text |
| number | number / number | number |
| boolean | switch / boolean | select with true/false |
| date | date / date | date |
| url, image | url / url | text |
| json | json / json | text |
| select, tag | select / select | select |
| multiSelect | multiSelect / multiSelect | multiSelect |
| dynamicType | resolved per row using typeKey | text across mixed types |
| custom | explicit catalogue or editor required | text or application filter |
| actions | no data editor | no data filter |

JSON form drafts preserve incomplete input, validate before schemas, and submit parsed JSON values. Primitive option identities, unknown choices and whitespace survive selection edits. Calendar inline writes now use `YYYY-MM-DD` in both editions, matching generated form writes; React consumers with `Date`-only inline schemas must accept the date string. Multiline editors use Enter for a newline and Ctrl/Cmd+Enter or dismissal to commit. Explicit form catalogues retain authority over missing, hidden and disabled fields. Generated bulk fields exclude heterogeneous dynamic types. Computed accessors need an explicit write mapping before inline editing can be enabled.

## Automatic page size

Both editions accept `table.enableAutoPageSize: true` (default: false). In table
mode the rows-per-page selector offers Automatic, followed by the computed row
count while active. Capacity uses the available viewport or scroll container,
header/footer space and the measured row heights in their display order.
Unseen rows use the smallest visible row as an estimate. Capacity may decrease
for later pages with taller rows and grows again after viewport/density changes
to avoid oscillating page-size requests. The layout identity uses the container
width, since an intrinsic table width can shrink on a later page without any
viewport change. Header wrapping and footer dimensions affect the measured fit
but do not invalidate that capacity ceiling when navigating between pages.
Resize, density, column width
and asynchronous content changes trigger recalculation; the table scroll area
is bounded for unusually tall rows or expanded groups. Page sizes stay positive
integers capped at 500, including in server `list` requests. The current first
record is used to choose the new page when capacity changes; selection follows
the existing pagination contract. The selector remains available on a single
non-empty page when the feature is enabled.

`table.defaultAutoPageSize: true` (default: false) starts table views in
Automatic mode when `enableAutoPageSize` is enabled. This includes a newly mounted
table, a saved-view switch, and returning from Gallery/Kanban. Numeric sizes remain
selectable and stay fixed through resize and server loading within the current view.
Without this opt-in, switching views returns to fixed pagination as before. URLs
and saved views retain the effective numeric size; with the opt-in, that number
is only the initial fallback until rows can be measured.
Gallery/Kanban do not claim to fit cards using table-row measurements. These
limitations are identical in React and Vue. Empty/hidden tables wait for usable
row measurements. Observers and animation frames are released on unmount.

Regression coverage uses the same capacity fixtures in both test runners, with
framework-specific default-mode/selector tests and real-browser resize/density verification
in the runnable examples.

## Grouped row rendering

Both editions render groups as expandable headings using the configured column
header, accessor value in the column's number or date format, and option labels
(including zero and false). Date columns always group by calendar month, with or
without `accessorKey`/`accessorFn`: the shared `dateGroupKey` keys each record by
its local `YYYY-MM` and `groupHeadingLabel` heads the group with the month's name
in the table locale ("March 2026", "mars 2026"). Headings count leaf records
across nested groups and never aggregate unrelated category IDs.
Expanded records retain all their ordinary cell values. Synthetic headings do not
activate or edit a record, and their selection controls only select permitted leaf
IDs. Selection-disabled tables use the full visible column span. Groups initially
expand when grouping changes; subsequent toggles remain local presentation state.

Enable `table.enableGrouping` and `table.showToolbar`, and keep eligible column
`enableGrouping` flags enabled. Grouping is local to the supplied records: a server
that paginates before returning records produces page-local groups.

Records without a value in Kanban lanes, Gallery sections and List sections are
grouped under one heading from the shared `emptyGroupLabel`: "No value", or
"Aucune valeur" in French locales. `null`, `undefined` and an empty
string share the `""` group key from `groupValueKey`, so moving a Kanban card to
that lane writes `""` in both editions.

Coverage: shared `tests/fixtures/grouped-rows.json` (including date columns with
and without an accessor), React `tests/grouped-rows.test.tsx`, Vue
`src/grouped-rows.test.ts`, the shared helpers in `tests/contracts-parity.test.ts`,
React Kanban/Gallery group suites and Vue `src/empty-group-label.test.ts`, plus
browser interaction in both editions.

## Optional filter bar

`table.filterBarColumns` declares an ordered subset of static-option or boolean columns. `table.showFilterBar` defaults to false, with a reactive `showFilterBar` component override in both frameworks. Column labels and choices come from the catalogue; disabled and unknown columns are excluded.

In both editions the optional bar sits below the title and above the standard view, search and Options controls, with 16 px between each section. Both editions use filter icons, searchable checkbox pickers and native column-filter state. Multiple choices retain their original numeric, string or boolean IDs. Hidden columns may still be filtered; hiding the bar preserves the query. Options exposes the same controls even while the bar is hidden. Reset and saved-view changes update the pickers. Text, date, range and remotely loaded option filters remain in their existing filtering surfaces.

Regression coverage: `tests/filter-bar.test.tsx` and Vue `components/filters/filter-bar.test.ts`, including false/zero IDs, multi-selection, hidden columns, Options synchronization, preference toggles and native reset.

Toolbar and historical filter controls use 32px height, 12px regular text, 16px action icons, and 12px dropdown chevrons in both editions. Icon-only actions are 32px squares. This geometry is independent from row density; cell controls and thumbnails still follow the selected density. Table/Kanban/Gallery share a 32px segmented frame whose buttons fit its inner height, keeping active and hovered backgrounds centered. Mode buttons retain translated tooltips, keyboard focus, and pressed state. React and Vue regression coverage exercises focus, display-mode transitions, and density choices; browser checks cover geometry and hover.

The local React Button and Tooltip follow the official [Shadcn Base Vega registry](https://ui.shadcn.com/r/styles/base-vega/button.json), refreshed on September 10, 2026, while retaining local aliases and the shared button-variants export. Vue adapts the official [Shadcn Vue Reka primitives](https://github.com/unovue/shadcn-vue/tree/dev/apps/v4/registry/bases/reka/ui) and [Vega styles](https://github.com/unovue/shadcn-vue/blob/dev/apps/v4/registry/styles/style-vega.css) to the existing standalone stylesheet: button hover/focus states and tooltip content/arrow styling use the same geometry without requiring Tailwind in Vue hosts. Its Tooltip forwards attributes and the trigger reference for composed menus. The table's explicit toolbar sizes override generic Shadcn size defaults; the segmented frame remains a Yayaw composition.

### Built-in default favorite

Both view managers expose the favorite star for the built-in default view as well as saved, shared, and system views. Choosing the default writes `setFavorite(null, context)` and fills its toolbar/menu star after success; an absent or inaccessible favorite has the same visual fallback. Clicking an already-favorite default is a no-op. Temporary unsaved view identifiers remain ineligible. The existing initial URL/host selection and shared-default precedence is unchanged. Regression tests cover clearing a saved favorite, failed writes, retry, and remount in both frameworks.

### Global operation notifications

React uses `sonner` and Vue uses `vue-sonner` for transient operation feedback: saved views, CRUD, exports, toolbar and bulk actions, and asynchronous action failures. Hosts mount one Sonner/Shadcn `Toaster`; the table never mounts a duplicate outlet or inserts a notification block that shifts content. Vue keeps internal status records for partial-operation retry handling. Loading, inline-save progress, field validation and actionable form/list errors remain contextual. The Vue distribution externalizes `vue-sonner` so its notifications reach the host's singleton; registry installation adds that dependency. Matching view/row/action regression coverage verifies the shared notification outcome.


## Responsive view menus

Both editions use a single desktop toolbar row: view, search, custom actions,
export, link sharing, then create. `actionsAsIcons` controls desktop labels.
Below 768px, or when the available container cannot fit the row, the toolbar
becomes **view / create / data actions**. The labelled data panel contains search,
custom actions, export and sharing. Compact targets are at least 44px.
Desktop uses an anchored panel; compact presentation uses a scrolling modal with
Back navigation and focus management. Quick filters move into its Filters screen.

The view panel contains selection, favorites, direct presentation and density,
settings, save, reset and delete. `enableViews: false` retains the View settings
entry. Column header filter/sort shortcuts still work.

| Setting | Table | Kanban | Gallery |
| --- | --- | --- | --- |
| Search / filters / sort | Yes | Yes | Yes |
| Grouping fields | Up to 2 | 1 | 1 |
| Density | XS, S, M, L, XL, 2XL | Hidden | Hidden |
| Properties | Columns, sizing, pinning | Card properties | Card properties |
| Footer calculations | When enabled | Hidden | Hidden |
| Card presentation | Hidden | Title, properties, labels | Also image, ratio, fit, size |

Catalogue flags and column capabilities further restrict these controls. Changing
mode retains inactive settings. Archives is a custom application action, never a
built-in record operation. See `examples/responsive-toolbar-react.tsx` and the Vue
product demo for host actions and compact composition.

`utils/view-menu.ts` is synchronized into Vue by `contracts:sync`; its mode
capabilities and normalized comparisons use common `tests/fixtures/view-menu.json`
fixtures. A filtered saved view starts clean; density, footer visibility, cards,
columns, search, filters, sort, grouping and page size participate in comparison.
Row selection and the current page do not. Advanced-filter identities, labels and edit timestamps are excluded; date values and AND/OR semantics remain significant. Manually restoring the saved settings
removes the blue indicator. Temporary views never show a saved-view difference.

Save changes remains visible and disabled when clean, with a desktop tooltip and
compact explanatory text. Save as new view remains separate. Reset view uses
Lucide ListRestart and never writes records. Legacy `showClearFilters` and
`showResetFilters` remain filter-only controls in Filters. Favorites do not require
save permission; failed or delayed saves preserve newer drafts.

`footerCalculationsVisible?: boolean` is included in snapshots; omitted legacy
values inherit the initial visible setting, subject to the feature flag.
Desktop sharing copies the current URL. Mobile uses native sharing when available,
falls back to copying, and silently accepts cancellation. It does not change a
saved view's organization visibility.

Reset restores the complete saved snapshot, including an empty grouping. A
Kanban lane in an inactive presentation never groups a table. Temporary views
restore the application defaults. Grouped headers, selection and leaf cells keep
the configured column order; React action cells retain native table-cell layout.
Utility columns remain visible when a data-only default visibility list is used.
Their automatic positions do not dirty a saved view or suppress its initial application;
shared fixtures still detect changes to the order of data columns.

The view panel follows its content height and uses a single Shadcn scroll area
only when needed. Compact height includes the drawer handle, header and safe-area
inset so the last action stays reachable. React keeps the toolbar mounted while
filtering or sorting requests load, preserving the open screen and keyboard focus.

The responsive React example's list adapter applies global search across all data
columns, typed quick filters, advanced AND/OR predicates, sorting and pagination
in that order. Remote consumer handlers remain responsible for the same query
contract. Both runnable examples include an application-owned `onBulkEdit` editor
that updates selected records, alongside the generated bulk catalogue form. React
custom writes refresh both record and calculation queries. Vue observes callback
changes after mount. React bulk icon buttons expose labels before hover and reveal
their text on keyboard focus.

Regression coverage includes actual React preview row order and filter results,
reset after grouping/density changes, saved filtered views, and selected-record
writes, plus equivalent Vue saved-view, bulk callback and grouped-layout tests.

### Advanced filter drafts

React and Vue keep numeric values and operators in a local editor draft until
Enter or the confirmation button is used. Typing `24`, zero, negative decimals,
or a range must not update the query between keystrokes. Blank or incomplete
numeric values cannot be applied; Escape discards edits. New Vue rules remain
outside query and saved-view state until their first application. The shared
`numeric-filter-drafts.json` cases verify both editions, including server request
counts in Vue and action calls in React. The runnable examples expose advanced
filters, with flat menu rows, ordinary inputs, and no implicit 0–100 slider or
extra nested card/scroll containers.

Vue column-header filter shortcuts open a local draft for the requested column.
Their tooltip-composed dropdown uses an explicit button anchor so it remains
visible and works with both mouse and keyboard.

Display mode and inline density use matching labelled button rows in both editions: equal-width choices, a muted selected background, no enclosing segmented border and no redundant mode tooltips. Both preserve keyboard focus and `aria-pressed` selection; density remains exclusive to Table mode.

## Gantt planning

Both editions support optional `displayModes: ["gantt"]`, `table.gantt`, `table.planning`, and
`actions.planning.load/preview/apply`, or no planning adapter at all when the gantt date columns are
mapped. The civil-date engine, record normalization, adapters, transactions, session, labels and the
`planning/timeline` model are copied by `contracts:sync`. See [Gantt configuration](GANTT.md),
[engine](PLANNING-ENGINE.md) and [persistence](PLANNING-ADAPTERS.md) for defaults and transactional
requirements.

Each edition renders the timeline with its own component — React `components/gantt-view.tsx`, Vue
`components/planning/GanttView.vue` — so a Gantt reaches its table's rows the way Kanban and Gallery
do: the table's own selection and title cells in the left column, row click through to the record
details, the loading overlay and the bulk-actions anchor. Both components compute rows, virtualization
geometry, bar placement, dependency paths, header cells and every date edit from the same shared
`planning/timeline` model, so behaviour stays equivalent while each presentation uses its own idioms
and theme tokens. The planning dialog stays a single shared surface, since it is a modal form with no
table state. A task from another source renders without cells rather than disappearing.
Without `table.gantt.titleColumn`, both editions title tasks with the first visible data column in
the current column order (never `select` or `actions`), so a hidden first definition is skipped.

Equivalent shared fixtures cover the four dependency types, signed/calendar offsets, summaries,
source identity collisions, invalid/cyclic/incomplete graphs, flags, permissions, stale previews,
atomic failure and idempotent retries. The shared timeline suite covers the week origin, zoom widths
and navigation steps, inclusive bar spans, collapsed ancestors, the centred date marker, the edit and
resize flags, and the mutations a pointer or arrow key produces. DOM tests cover draft retention,
exact relation previews, cancellation and instance isolation in the dialog; per-edition component
tests cover each timeline's own wiring, including the default title column (React
`tests/gantt-title-column.test.tsx`, Vue `components/planning/gantt-view.test.ts`). Both editions use the same bounded virtual timeline; hidden
links remain available in the editor and constrain planning.

### Embedded Gantt examples

Both editions are available in the Gantt guide's existing framework tabs and
Preview / Code controls. The examples share tasks, calendars and dependencies,
including a release in a second source. Both support preview, cancellation,
application, view switching, reset and theme inheritance. The Yayaw example
verifier checks the actual pinned React and Vue registries, including the other
embedded examples, before building the two production preview bundles.

### Responsive view settings

- React and Vue use compact labelled selectors for Gallery and Kanban cards. Properties use persistent checkbox screens within the view menu.
- Gantt zoom, first weekday and dependency visibility live under View → Gantt settings. Timeline navigation and reload remain next to the timeline; saved-view and URL keys are unchanged.
- Mobile and constrained toolbars keep settings choices inside their existing drawer, sharing one header, focus boundary and scroll region. Back restores the originating control. Long lists retain scrolling; short panels do not force a scrollbar.
- Planning task and dependency dialogs use bottom sheets below 768px, with bounded height and touch targets. Timeline scrolling remains available independently.
- Density and display choices use normal font weight, including selected options. Share uses the same 32px desktop height and 44px minimum mobile target as other toolbar actions.
- Regression coverage: `tests/view-settings.test.tsx`, Vue `components/card-controls.test.ts`, and the shared planning workflow suite. Browser checks cover React and Vue desktop/mobile view settings and toolbar dimensions.

## Saved view permissions

`TableView.canEdit` and `TableView.canDelete` are optional, independent host-resolved permissions in React and Vue. `false` prevents the corresponding manager and local-storage action. Omission preserves the existing behavior. System views and `allowViewSave: false` remain read-only regardless of these flags. Selecting, copying and favoriting a shared view do not require ownership. These flags describe UI capabilities; remote persistence must enforce current actor, scope and write authorization itself.

Coverage: React saved-view manager tests and Vue saved-view interaction tests cover read-only shared views and independently allowed edit/delete actions.

## Shared record presentation

`TableConfig.presentation` controls view, create, edit, and catalogue bulk edit in both registries. It accepts `"drawer" | "modal" | "inline"` or `{ desktop, mobile? }`. The default is drawer everywhere; an omitted mobile choice inherits desktop. The shared breakpoint is below 768px. Mobile drawers fill the viewport width, desktop drawers default to 40rem, and modals default to 48rem within viewport limits. Explicit legacy widths remain supported. Inline records are embedded page sections, separate from cell editing.

The root choice overrides the legacy `details.presentation`, `FormConfig.presentation`, `form.presentation`, and `form.layout.mode` fallbacks. The latter layout alias is now accepted by both editions. Standalone details/forms accept the same responsive shape. Application-owned `onBulkEdit` callbacks, Vue's explicit JSON compatibility editor, and nested confirmations/collection editors retain their own presentation. The built-in bulk default changes from a desktop modal/mobile bottom panel to drawer.

View, edit, and bulk share Shadcn theme tokens, headers, padding, scroll regions, and form footer placement. View-to-edit keeps the same surface mounted; cancel discards the draft and returns to consultation, and successful save refreshes consultation. Stable portal/teleport targets preserve fields and drafts even when resizing between inline and overlay presentations. Submitting/validating forms block closing; focus returns to Edit after cancel/save and to the opener when an overlay closes.

Verification: `tests/fixtures/record-presentation.json`, React `tests/record-presentation.test.tsx`, Vue `components/forms/record-presentation.test.ts`, and the existing form/bulk/details integration suites cover defaults, responsive inheritance/overrides, legacy precedence, all four operations, save/cancel continuity and draft retention. Run the comparable examples with `bun run records:dev` and `bun run vue:dev` (`?example=records`), including mobile and gallery/Kanban activation.

## Video record consultation

React and Vue accept `DetailField.type: "video"` in built-in and standalone record views. Values can be an HTTP(S) URL or `{ url, poster?, tracks? }`; caption tracks use `{ src, srcLang, label, default? }`. Source, poster and caption URLs follow the existing HTTP(S) policy. Invalid sources render as text, invalid posters/tracks are omitted, and empty values retain the standard empty label. Both editions expose native controls, inline playback, metadata-only preload, no autoplay, an accessible field label, and optional captions. Uploaded media without caption data does not gain synthetic captions. Gallery thumbnails remain images; activating a gallery card opens the configured record view.

Shared `tests/fixtures/record-media.json` exercises URL validation, posters, captions and empty values in React and Vue DOM tests. Both record presentation examples include the same video record; the Vue example is available from `demo/App.vue?example=records`.

## Gallery media workspace and activity shortcuts

- React and Vue share `media-contract`, the native media viewer/thumbnail adapter, deterministic stored-value tag colors, shortcut ownership, and activity undo helpers. Gallery media is opt-in through `table.gallery.media.enabled`; supported types are image, video, audio, document/PDF and file fallback. Preview opens the media, Info opens the record. Playback never autoplays in the viewer; opt-in muted hover samples last five seconds and respect reduced motion.
- `gallery.previewSize` is `small | medium | large` (default medium), independent of card width and serialized with saved views. Runtime `media`, `getMedia`, `renderMedia` and `renderProperties` do not enter persisted state. React render callbacks return React nodes; Vue callbacks return VNodes. Custom renderers own their activation.
- `table.coloredTags` defaults to true with per-column overrides. Neutral tags and wrapping metadata are available on both surfaces. Colors use stored values, including when option labels are translated. Vue's former neutral tags/square gallery defaults can be retained explicitly with `coloredTags: false` and `aspectRatio: "square"`.
- Gallery modifier-click selects without activation; Shift extends the visible selectable range. Table checkbox ranges and gallery ranges share their framework's selection anchor. Ctrl/Cmd+A selects all matching permitted rows across pages, including from body focus when exactly one table is visible. Input/editable/overlay scopes retain native keyboard handling; multiple tables choose the last interacted scope.
- Ctrl/Cmd+Z reuses `DetailActivity`, `canRevertDetailActivity`, `details.canRevert`, and `onRevertActivity`. Optional `details.history()` supplies `{ row, activity }` for deleted/off-page records. `transactionId` groups inverses; successful partial results refresh once and are not retried. This is sequential compensation, not an atomic batch transaction. Applications persist history, choose the undo scope, authorize actions and make deletion reversible. Redo and clipboard mutations are not inferred.
- Both editions expose custom `rowActions`; React uses an icon node and Vue `iconComponent`. Native media menus add Preview and Copy link; information uses Info. Menus size to content with viewport bounds. Native viewer theme follows the originating table, and closure restores focus.
- Shared regression suites cover shortcut ownership, editable scopes, hidden/multiple tables, deleted-record undo, batch compensation, partial retries, permissions/conflicts, media URL validation, fit/preview sizing, tag identity, navigation and focus. React and Vue record examples demonstrate gallery media and application-owned reversible deletion. PostgreSQL-backed media retention belongs to the companion Yayaw change, not to either registry.

Undo emits one localized success notification only after the entire inverse operation and refresh succeed, including grouped shortcuts. Partial failures keep their error and do not claim success; retries notify once complete. Record activity buttons use the same sentence. `details.labels.undoSuccess` accepts a complete translated sentence with an optional `{action}` placeholder, avoiding grammatical gender inference. Shared fixtures cover English/French messages and S/M/L view serialization with runtime media/renderers excluded in both editions.

Ctrl/Cmd+D uses the existing duplicate action on all selected permitted records, including off-page selections. Both editions block reentrancy/repeat keys, refresh once, select returned copies, retain unprocessed originals on partial failure, and show translated singular/plural feedback. React consumers should pass `getRowId` with stable record IDs when using cross-page or duplicate selection, as shown by the runnable example. `duplicate-shortcut-suite` and browser checks cover both editions.

## Versioned publication gate

React and Vue continue to share the root SemVer version. CI marks a registry
artifact publishable only when both package versions and the release manifest
agree and the generated React, Vue, base, font and index payloads exactly match
the same committed version snapshot. An unreleased change to either edition
keeps the previous public registry in place. Release input detection covers
both editions and shared contracts, including style changes without a
conventional commit bump. No runtime API, defaults or example interactions
change. Regression coverage lives in `.github/scripts/registry-publication.test.mjs`,
`release-inputs.test.mjs`, `release-plan.test.mjs` and `pages-provenance.test.mjs`.

## Remote boards and custom filters

Both editions accept `table.kanban.server`: `queryKey`, `groups(signal)`,
`rows(group, cursor, signal)`, optional `getRowId`, `onActivate`, and localized
`labels` (`loading`, `retry`, `loadMore`, `empty`). Groups return stable `value`,
`label`, and global `totalCount`. Pages return `rows` and nullable `nextCursor`.
The host changes `queryKey` when query, authorization scope or refresh identity
changes, and captures that immutable query in the callbacks. Aborted requests
cannot restore a previous scope. Counts are never inferred from loaded rows.

Remote boards are explicitly read-oriented: no drag mutation, grid pagination,
selection or bulk operations on partially loaded lanes. Cards expose the supplied
activation command. Existing local boards retain their full interaction contract.
Hosts that need bulk work use the grid and its complete selection API. Neither
framework synthesizes rows into the grid cache or trusts client permission checks.

`ColumnDefinition.filterRenderer({ value, onChange })` renders an application
control inside the native filter menu. It uses the same typed column-filter state
as views and reset. The optional historical quick-filter bar remains independent.
The host owns control labels, validation, remote option loading and API translation.
Shared remote lifecycle regressions run in both frameworks.

## Display mode registry

`utils/display-modes.ts` is the single list of display modes, synced to Vue by
`contracts:sync`. It declares each mode's table-only controls, grouping depth,
saved-view/URL settings key and whether it needs a planning session.
`resolveDisplayModes` and `resolveDisplayMode` decide which modes a table offers
and which one renders, so a link or saved view asking for an unavailable mode
shows the same fallback, and the same active switcher choice, in both editions.
Icon maps are typed by `TableDisplayMode`, so a new registry entry fails the type
check until each edition gives it an icon. Resetting a view clears every mode's
settings, including Gantt.

## Scoped row loading

Views that need every matching row of a window, not one page, use
`loadScopedRows` from `utils/scoped-rows.ts` (synced to Vue). It sends the usual
list parameters plus an optional `scope`. A `dateRange` scope names local
calendar days, both inclusive; a row matches when its start (and optional end)
overlaps them, with the same local-day semantics as date filters.

Filtering by scope on the server is preferred. A list action that applied it
answers `meta.scope: "applied"`; otherwise the loader filters each page itself,
so existing hosts keep working with more data transferred. Results are capped
(`maxRows`, 2000 by default): views either show a `truncated` result or, with
`overflow: "throw"`, refuse an incomplete one. Vue's local-data mode filters its
rows the same way. `tests/scoped-rows-suite.ts` runs in both editions.

## Multiple sorts and filter combination

Both editions keep an ordered list of sorts and send every sort to list actions.
React's sort menu adds a clicked column as the lowest-priority sort, reverses it
on the next click and removes it on the third, numbering priorities when more
than one sort applies; Vue edits the same list with one rule per sort. With two
or more advanced filter rules, both editions offer "Match all / any condition"
(`filters.match`, `filters.combination`, `filters.match_all`,
`filters.match_any`), stored as the rules' `joinOperator` in views and URLs.
Playwright `e2e/views.spec.ts` checks the combination round trip in both
editions.

### Default sort

The sort a table starts from is, in order: the URL (`<tableId>-sort`), the
saved or initial view, then `columns.sort`. Without any of them no sort is
sent and every mode keeps the order `list` returns; the table adds no implicit
order (by id, date or anything else). Modes that define their own order when
nothing is sorted keep it: Feed sends its date column descending. Reset
returns to `columns.sort`. Both editions apply this to every hook of the table
(React reads `columns.sort` through `TableStateSyncProvider`, which now wraps
the whole table, Vue starts its sorting state from it); React used to start
from no sort and only applied `columns.sort` when the default view was chosen
again, so a host that orders by id when nothing is sorted showed React by id
and Vue by the configured column. Playwright `e2e/default-sort.spec.ts`
(`?example=default-sort`, the same rows and list handler in both demos) checks
table, Kanban, Gallery and Gantt with and without `columns.sort`, and that a
URL sort wins.

Initial rows follow the same default. `initialData` (with `initialPageCount`
and `initialRowCount`) is the host's first page of the table's default state:
page 1 at `table.defaultPageSize`, no filters or search, sorted by
`columns.sort` when it is set. Both editions show it at once, on the server and
in the first client render, when the table starts in that state, the
configured sort included. React used to take it only when no sort was set, so
from 3.6.1 a table with `columns.sort` and initial rows rendered no rows on the
server and skeletons until its first request. Unless the host names the sort
it produced the rows with, rows shown under `columns.sort` load again once on
mount in that sort, which corrects rows produced in another order. With
`initialDataSort` equal to `columns.sort` the rows are current: neither edition
requests that page on mount, and an invalidation still reloads it. Rows are
the default state's only: a table starting on another page or page size, with
a filter or a search, or in a URL or view sort that differs from `columns.sort`
waits for its own request, as before (React shows its loading state instead of
them, Vue keeps them under its loading overlay). One earlier difference
remains: rows without `initialDataSort` for a table with no sort at all are
kept by React for its query's stale time (30 s), while Vue loads that page
again on mount; `initialDataSort: []` avoids the request in both.
`utils/initial-rows.ts` (copied to Vue) decides for both editions and
`tests/initial-rows-suite.ts` runs in both suites; `tests/initial-rows.test.tsx`
and Vue `initial-rows.test.ts` check server rendering, the single reload and
its absence, and Playwright `e2e/default-sort.spec.ts` (`&initial=list` or
`&initial=sorted`) checks that the first table each demo paints already holds
the host's rows, without skeletons.

## List view

`displayModes: ["list"]` renders one line per record in both editions: the
selection checkbox, the title column, the chosen properties and the row actions.
`table.list` sets `titleColumn`, `cardColumnIds` and `showCardLabels`; without
`cardColumnIds` every non-title data column is shown. The grouped column is
omitted from properties and lines are sectioned by the first grouping level
(`maxGroups: 1`), headed "Column: value" with a count; empty values read
"No value" ("Aucune valeur" in French), like Kanban and Gallery. Settings are saved in views and in the `<tableId>-list` URL key, and
resetting a view restores `table.list`. The list uses the current page, like
Gallery and Kanban. Density applies to lines as to table rows: both editions
size them from the shared `TABLE_DENSITY_METRICS`, and the density control is
offered in List mode through the registry's `capabilities.density`. Covered by `tests/list-view.test.ts`, Vue
`use-table-state.test.ts` and Playwright `e2e/views.spec.ts` in both editions.

## Manual order per view

`table.manualOrder: true` plus `actions.reorder` offer "Manual order" in both
sort menus (`sorting.manual`; Vue `manualOrder`). It is the sort
`[{ id: "__manual", desc: false }]`, replaces column sorts, and is saved with
views and URLs like any sort. List requests with it also carry `viewId`, the
active saved view or `null` for the default view; the host sorts by that view's
own order. Records are never modified.

While the List view uses this sort and editing is allowed, each line shows a
drag handle driven by pointer events in both editions, so mouse, touch and pen
behave alike (native drag and drop ignores touch), and a focused line moves
with Alt+ArrowUp/ArrowDown. Lines move only within their group; the target
line shows a top marker. The move shows immediately, calls
`reorder({ viewId, id, previousId, nextId }, { row })` and refetches; a failure
shows the error and the next result restores the server order. `canEditRow`
applies. Shared helpers live in `utils/manual-order.ts`; covered by
`tests/manual-order-suite.ts` in both editions and Playwright
`e2e/views.spec.ts`, including a touch drag sent through Chromium's input
protocol.

### List options

`table.list` and saved views also accept `wrap` (default `false`),
`showActions` (default `true`), `propertyAlign` (`"end"` by default, or
`"start"` right after the title), `maxProperties` and `mobileMaxProperties`
(below 768px; the lower limit wins). Both editions normalize and resolve them
through the shared `utils/list-view.ts` and offer them in the List settings
panel. Covered by `tests/list-view-suite.ts` in both editions and Playwright.

## Number and date formats

`utils/value-format.ts` (synced to Vue) formats numbers and dates in both
editions. `numberFormat` accepts the historical presets (`"space"`, `"dot"`,
`"comma"`, `"locale"`, which keeps two decimals at most everywhere), React's
`decimals` and Vue's `decimalPlaces`, and adds `style` (`decimal`,
`currency`, `percent`, `compact`, `unit`), currency and unit display, min/max
fraction digits, separators applied to any style, `prefix`/`suffix` (the
affixes and separators keep their spaces as stored, e.g. `" kg"`),
`signDisplay`, `negative: "parentheses"`, `percentBase` (`fraction` or
`whole`) and `display: "bar"` with `max` for a progress bar. Dates share the
17 presets, `dateFormat` patterns, `timeZone` and `hour12`. A pattern wins
over the preset (React table cells now honour it, and `timeZone`/`hour12`,
instead of the table's default preset), `timeZone` applies to presets and
patterns alike, and date-only strings are local calendar days that no zone
shifts. `"relative"` uses `Intl.RelativeTimeFormat` in the table locale. Date
columns without a preset take the table's `dateDisplayPreset` in both
editions (Vue's `defineTableConfig` did; React now fills it when it resolves
the config). An unknown zone shows local time and an invalid pattern falls
back to the preset instead of failing.

Known difference kept for compatibility: a number column without
`numberFormat` shows the raw value in React cells and card properties
(`1234.5`) and a locale-grouped value in Vue (`1,234.5`); the shared surfaces
(footers, group headings, charts, feed, map, record view, exports…) use the
locale's grouping in both. Set `numberFormat` for identical output.
`tests/value-format-suite.ts` runs in both editions.

## Formats apply everywhere

A format set on a column (`numberFormat`, `dateDisplayPreset`, `dateFormat`,
`timeZone`, `hour12`, else the table's `dateDisplayPreset`) applies wherever
the field shows, in both editions, through one shared helper per value type:

- `formatColumnNumber`, `formatColumnDate` and `formatColumnValue`
  (`value-format.ts`): a value in its column's format and the table locale.
- `formatColumnDay`: a calendar day (chart day and week buckets, filter
  values, dashboard date chips, Gantt days, form answers) in the date part of
  the column's pattern or preset, never with a time, never shifted.
- `formatColumnCalculation`: sums, averages, medians, extremes and ranges in
  the column's format (date extremes in its date format, date ranges in days,
  "9d"/"9j"); counts stay plain whole numbers and `percent_*` plain percents,
  in the table locale.
- `fieldText` (`table-contracts.ts`): a value as one line of text for titles,
  headings and labels read aloud (option labels, number and date formats,
  places); `groupedValueLabel` takes the column to use it.

Surfaces, in both editions: table cells of every type and inline cells when
not editing; footer calculations (local, list fallback, and server results
without a label); table group headings; List lines and group headings; Kanban
cards, lane titles, card names read aloud and the server Kanban's cards and
titles; Gallery cards, alt text, viewer titles and group headings; Calendar
event titles and tooltips; Gantt bars, tooltips, day titles, label tooltips
and the planning dialog (names, days, changed fields, through
`planningFormatters` and `PlanningSurfaceOptions.formatters`); Chart axes,
data labels, tooltips, legend and "Show as table"; Dashboard numbers (KPIs
are charts) and date filter chips; Feed titles, date line, properties and
group headings; Map marker titles, list panel and popups; File tree number
and date columns (a `numberFormat` on the size column wins over file units;
the Updated column reads relative for a week, then in its format); the
record view for every field and the activity's before/after values (fields
listed in `details.sections` inherit their column's formats; a field's own
Intl `numberFormat` still wins); filter chips and active filter summaries
(React; Vue edits rules inline and has no chips) and the date filter button;
Form view answers once typed or picked and the review step; the Import
preview; Export "as displayed" and the `exportFile` request; connector
previews and conflict lists.

Values stay raw where that is the point: `list`, `update`, `aggregate` and
the other server contracts, connector pushes and syncs, the Raw export,
editors while editing (inline inputs, filter value inputs, a number question
while focused, catalogue form fields), and import mapping samples (the file's
own text). Copying selected text copies what is displayed; the bulk Copy
action (a host `onBulkCopy`/`bulkCopy`, or React's built-in JSON fallback)
works on the stored records.

Kept on purpose:

- Chart month, quarter and year buckets keep their period names
  ("Sep 2026", "Q3 2026").
- The feed's relative date line reads relative time (the column's format is
  in its hover title), and so does the file tree's Updated column during its
  first week.
- Calendar events and Gantt bars sit on the browser's local day; the column's
  `timeZone` applies to their text.
- Patterns print date-fns tokens, so their month and day names are English;
  presets are localized.
- Catalogue form date pickers (create, edit, bulk edit) show the picked day in
  the table language.

Coverage: the format matrix `examples/value-formats.ts` (currency EUR, percent
progress bar, unit, compact, a pattern in Europe/Paris, a date and time
preset, spaced prefix, suffix and separator), `tests/format-matrix-suite.ts` and `tests/value-format-suite.ts` in
both editions, and `e2e/value-formats.spec.ts` on both demos in English and
French (`?example=formats`, `?example=formats-dashboard`, `&locale=fr`).

## Visual parity

React is the visual reference. Vue matches its toolbar (compact search with an
icon), table header (14px medium text, column separators, column menus revealed
on hover or focus), checkboxes, Kanban (bordered board and lanes, 18rem lanes,
compact cards with number and date chips) and gallery (bordered panel, image
placeholder). Both editions offer Create, Edit, Delete and Duplicate only when
the matching action exists, omit the row-actions column when no action can be
offered, and show every card property by default. Pixel baselines differ by
platform fonts, so Playwright checks measurable styles in both editions
instead: header font, row height, checkbox size, search width and card titles.

### Shared theme tokens

React styles come from shadcn/ui (Tailwind and the shadcn CSS variables); Vue
keeps its own stylesheet, whose `--yayaw-*` tokens now read the same shadcn
variables with the neutral theme as fallback, so a host theme applies to both
editions. Controls use `rounded-md` (`--radius` − 2px), inputs and outline
buttons `--input` at 30% with a light shadow, badges a 0.35rem radius, the
header row `--muted` at 20%, the selection column 48px with a centered
checkbox, and text is antialiased. Both editions show the default description
`Manage your <tableType>` when none is configured.

### Generic per-mode settings

A registry entry with `configKey` and `normalizeConfig` has its settings handled
generically in both editions: `GenericModeViewConfigs` types `table.<key>` and
saved views, `<tableId>-<key>` stores them in the URL, and state, snapshots,
view application, sharing and reset loop over `GENERIC_MODE_CONFIG_KEYS`.
Kanban, gallery and Gantt keep dedicated code for their historical migrations.
Adding such a mode needs its registry entry and type, its renderer and settings
panel per edition, labels and tests. `tests/generic-mode-config-suite.ts` runs
in both editions.

## Calendar view

The calendar ships as optional registry items so the table block keeps no
calendar dependency: `yayaw-table-calendar` (React, `@fullcalendar/react`) and
`yayaw-table-vue-calendar` (Vue, `@fullcalendar/vue3`), both FullCalendar 7
with the classic theme mapped to the shadcn tokens. A host installs the item,
passes `displayModeRenderers: { calendar: calendarRenderer }` and lists
`"calendar"` in `displayModes`; without the renderer the mode is withheld like
Gantt without a planning session (`requiresRenderer` in the registry).

The shared `calendar-model.ts` resolves settings (first date column and first
other column by default), turns rows into all-day events with an exclusive
end, builds the `dateRange` scope of the visible range for `loadScopedRows`
and writes moves back in the stored format (date-only stays date-only, ISO
keeps its time). Both editions render their own toolbar (previous, today,
next, title, Month/Week/List) and the same event pills with tag colors from
`colorColumn`. Dragging calls `actions.update` and reverts on failure;
stretching needs `endColumn`; clicking a day opens the create form with the
date (and end date) prefilled. Layout changes are view settings.

Renderers receive a framework-neutral context: settings and their setter,
current list parameters and action, local rows, row id, permissions,
`updateRow`, `openRow`, `createRow` and a `revision` that changes after each
mutation. React translation keys are `views.calendar.*`; Vue keys are
`calendar.*` with English and French defaults. `tests/calendar-model-suite.ts`
runs in both editions and `e2e/calendar.spec.ts` covers both demos.

## Chart view

Charts ship as optional registry items, like the calendar:
`yayaw-table-chart` (React, shadcn/ui `chart` with Recharts; the item lists
the `chart` shadcn component and `recharts`) and `yayaw-table-vue-chart` (Vue,
`@unovis/vue` and `@unovis/ts`, the engine behind shadcn-vue charts; the item
ships its own markup and tokens, like the rest of the Vue edition). Both load
their view lazily (React `lazy` + `Suspense`, Vue `defineAsyncComponent`), so
the chart library is fetched with the first chart shown. Hosts pass
`displayModeRenderers: { chart: chartRenderer }` and list `"chart"` in
`displayModes`; `table.chart` holds table defaults and `table.chart: false`
removes the mode (`withoutDisabledModeRenderers`).

The shared `chart-model.ts` owns everything but the drawing:

- Settings: `type` (`bar`, `horizontalBar`, `line`, `area`, `combo`,
  `donut`, `funnel`, `number`), `xColumn`, `bucket`, `weekStartsOn`,
  `metric`, `metricColumn`, `seriesColumn`, `stacked`, `stacking`, `curve`,
  `lineMetric`, `lineMetricColumn`, `stageOrder`, `sort`, `cumulative`,
  `hideEmpty`, `topN`, `showDataLabels`, `showLegend`, `colors`, `fill`. Saved with
  views and in `<tableId>-chart`. Defaults: bars, first option column (else
  date, else any groupable column), count, `stacking: "stacked"`,
  `curve: "smooth"`, `lineMetric: "count"`; views saved before these settings
  resolve as they did. A metric (or line metric) reading a column falls back
  to a count without a fitting column; choosing it in the settings picks the
  first one. Series apply to bars, lines and areas. The settings panel is
  `chartSettingFields`, rendered by each edition's `ViewSettingsPanel`, so
  both show the same fields in the same order, followed by the funnel's
  stage order (`chartStageList`).
- Contract: `actions.aggregate` receives the table's query plus
  `groupBy: [{ columnId, bucket? }]` (at most two levels), `metrics`,
  `timeZone` (the x column's `timeZone`) and `weekStartsOn`, with empty
  `calculations`; it answers `{ groups: [{ keys, values }], truncated? }`.
  Keys: `null` for empty values, `YYYY-MM-DD` days, the first day of `YYYY-MM-DD`
  weeks, `YYYY-MM` months, `YYYY-Qn` quarters, `YYYY` years; multi-select values
  count in each of their groups. Combo charts ask for both metrics in one
  request (`metrics: [bars, line]`, `values` in that order). `loadChartData`
  falls back to `loadScopedRows` + `aggregateChartRows` when there is no
  aggregate action, when it fails, when it answers without `groups` (column
  calculations only) or with fewer values than metrics. The demo host uses
  `aggregateChartRows` as its in-memory implementation, and rejects column
  calculations so they keep the list fallback.
- Model: date buckets in the column's zone (date-only values stay calendar
  days, so DST never moves them), missing buckets and options filled unless
  `hideEmpty`, sort (automatic: option order for selects, label for dates,
  numbers and booleans, value otherwise), top N with an "Other" group for
  additive metrics (count, sum), cumulative totals for bars, lines and areas,
  at most ten series (the rest folded into "Other"), option colors (explicit
  option `color`, else the tag hue when tags are colored) or the
  `--chart-1…5` palette, value formats from the metric column's
  `numberFormat`, number groups in the x column's format, day and week
  buckets in the date column's format without its time (months, quarters and
  years keep their period names), round value ticks (`chartValueTicks`, whole numbers for
  counts) and EN/FR labels (`chart.<key>` overrides the built-in text in both
  editions). `chartValueText` gives tables and tooltips the same text.
- Areas: one area per series, stacked on each other (`stacking: "stacked"`,
  ticks fit the totals), stacked to 100 % (`"percent"`: `categories[].shares`
  are drawn, ticks 0–100 %, tables and tooltips show "2 (50%)") or
  overlapping (`"none"`, ticks fit each value); a single series is one area.
  `curve` (`smooth` or `linear`) is shared with lines and the combo's line.
- Combo charts: bars for `metric`/`metricColumn` and a line for
  `lineMetric`/`lineMetricColumn`, as series `bars` and `line` with their own
  formats. Each metric's unit comes from its column's number format
  (`chartMetricUnit`: count, `currency:EUR`, `percent:fraction`, `unit:…`,
  number); when they differ the line gets a right axis whose ticks
  (`secondaryTicks`, `chartAlignedTicks`) have as many steps as the left
  axis', so both share the grid lines. Sorting and top N follow the bars;
  "Other" needs both metrics additive; an empty group has both metrics at
  zero. The legend lists both metrics; there is no series column.
- Funnels: one stage per x value in `stageOrder`, then the automatic order
  (the option order for selects); records without a value are in no stage.
  Each stage has its value (count or metric), its share of the first stage
  and its conversion from the previous one (`—` after a zero), and the texts
  "100% of first" / "67% from previous". `chartFunnelLayout(stages, width)`
  draws the same shapes in both editions: stages side by side (vertical
  funnel, 320 px tall) when each gets 120 px and the chart is 480 px wide,
  otherwise stacked from top to bottom (horizontal funnel, 76 px per stage);
  a stage's leading edge is as long as its value against the largest, its
  trailing edge as the next stage's, and zero stages keep a 2 px sliver. Both
  renderers measure their width (`ResizeObserver`), so funnels fill a
  dashboard widget or a phone. Settings: axis, metric, hide empty stages,
  legend, colors, and the stage order list for option columns: drag a stage,
  or use its "Move … up/down" arrows (focus stays on the moved stage); an order
  equal to the table's is not saved, "Reset the order" removes the view's.
- Click to filter: a group becomes the advanced filter rules the filter menus
  write for its column: the column's filter type (`dataTypeFilter`: yes/no
  columns are selects, emails and links text) with one of its operators
  (select `isAnyOf` with the stored value, `true`/`false` for yes/no groups,
  multi-select `contains`, date bucket `between` first and last day, empty
  groups `isEmpty`, others `equals`), so hosts, saved views and the filter
  menus read them like any rule. They are appended to the view's rules with
  `and`, then the table (else the list) opens. Renderers call the new
  `showRecords(rules)` of the context, which also exposes `aggregate` and
  `advancedFilters`. "Other" groups are not clickable; when the view's filters
  match any rule (`or` with two rules or more) groups cannot be added and the
  hint says so. Area and combo charts filter the category whose band is
  clicked (bars, points or the area); funnels have a button over each stage.
  React's filter menus show and edit yes/no and number values of such rules
  against their text choices. We chose opening the table over an inline list
  so the records keep every table feature and the filter stays visible and
  editable in the filter menus.

Accessibility: a "Show as table" toggle lists the chart's numbers in a table
whose group names are buttons ("Show the records of …"), the keyboard path to
filtering; the funnel's table lists stage, value, "% of first" and
conversion. Recharts adds its keyboard layer (arrow keys move the tooltip);
Unovis marks are hidden from assistive technology and rely on the table. The
funnel is an SVG `img` named by the chart title and described by every
stage's numbers, with a real button over each stage ("Show the records of …",
in the tab order, a visible focus ring).

Rendering differences the engines impose: React labels segments with
Recharts `LabelList`, Vue with Unovis `XYLabels` (grouped, unstacked bars have
no per-bar labels in Vue; the table lists the values) and scatter labels for
lines; donut values are shown in the legend in both editions; tooltips follow
each engine's positioning. Both use the same legend markup, title, hint,
table fallback, ticks and colors. React draws areas and combo charts with
Recharts `AreaChart` and `ComposedChart` (two `YAxis`) and reads the clicked
category from the tooltip index (pointer events are not throttled, so a tap
selects the category under it); areas skip x labels that would overlap. A
Unovis container holds one value axis, so the Vue combo chart draws the right
axis' labels as text over fixed margins; Vue areas and combo charts take the
category from the crosshair on the next frame. As for lines, React pads the
x axis by 40 px and Vue by half a category. The funnel is the same SVG in
both editions. Vue charts shrink with their container (the chart grid has a
`minmax(0, 1fr)` column), as React's `ResponsiveContainer` does. On narrow
charts, x labels of lines and areas that would overlap are skipped (Recharts'
default interval) or hidden (Unovis `tickTextHideOverlapping`), and
horizontal bars with data labels keep `chartBarLabelRoom` pixels past the
longest bar so its value is not cut at the edge (both checked at 390 px).

`fill: true` (a chart setting, set by dashboards on their embedded tables)
makes the chart take the height of its nearest size container (`100cqh`)
instead of 320px, without title, table toggle or hint. Each edition measures
the room left and follows `chartFillLayout` (shared): the legend beside a
donut in a wide box, under a chart when the plot keeps 96px, beside it when
that fits, else none; data labels only with room per category; no value axis
under 220px or when bars carry their values; category labels thinned (Recharts
`preserveStartEnd`, Unovis every `categoryStep`-th tick with overlapping ticks
hidden); small donuts show their total alone.

Verification: `tests/chart-model-suite.ts` runs in both editions (settings,
request and parameters, buckets incl. DST and week starts, labels, every
metric, multi-select, series, sorts, filled and hidden groups, cumulation,
top N and Other, formats, colors, filter rules, server and fallback parity,
ticks, settings fields; the new settings and their defaults, area stacking
with shares of 100 %, combo requests, units, aligned ticks, Other and the
one-metric fallback, funnel order, rates, texts and shapes in both
orientations, the stage order list, and group rules of every column type,
checked with the shared matcher to select exactly each group's records).
`e2e/chart.spec.ts` covers both demos: the "Revenue by category" view with
and without `aggregate` (`?example=views-fallback`), type/axis/metric changes
kept in the URL, legend and data labels, donut totals, clicking a bar, the
table fallback opening a group and the "Projects over time" view.
`e2e/chart-types.spec.ts` covers the new types on both demos: "Revenus et
marge" (combo, both axes, legend, table numbers with and without
`aggregate`, clicking a bar), switching a chart to a combo with a line metric
and a straight curve, "Pipeline" (funnel texts, vertical then horizontal on a
phone, table, clicking a stage, reordering by arrows and by drag, reload,
reset), "Livraisons cumulées" (stacked areas, table, 100 % stacking, clicking
a week) and yes/no groups (checked, unchecked, no value) filtering the table
with select rules that survive a reload. The views demo shows three saved
views as tabs (`viewTabs.maxVisible: 3`) so the toolbar stays on one line;
the others (Projects over time, Revenus et marge, Pipeline, Livraisons
cumulées, Updates, Sites) are under "More". It gains two hidden columns read
by charts: Margin (a percent) and Invoiced (yes/no, empty for Foxtrot).

## Feed view

`displayModes: ["feed"]` shows each record as a post in a centered column
(720px at most) in both editions. The mode ships in the table items like the
Form mode: `withFeedRenderer` plugs the built-in `feedRenderer` in (a host
renderer for `feed` wins) and `table.feed: false` withholds it. Its view loads
lazily, like the Chart and Map views (React `lazy` + `Suspense`, Vue
`defineAsyncComponent` with `delay: 0`): the fallback is the feed's own loading
state (skeleton posts and "Loading…" for screen readers), so nothing jumps when
the code arrives; the settings panel stays in the table's code. Posts show the
title (a button opening the record view like a row click), the author (text,
or `{ name | label | email, avatarUrl }` with initials otherwise) and the date,
the body, media and properties. Dates are relative by default ("3 hr. ago",
"il y a 3 h", "yesterday"; calendar days compare by local day) with the date
in the column's format in `title` and `<time datetime>`, or absolute (the
column's format).

The body is plain text (`white-space: pre-wrap`), clamped to `bodyLines` lines
with a 1.5 line height; "Show more" / "Show less" is a button with
`aria-expanded` and `aria-controls`, offered when the measured body overflows
(the length estimate applies before layout). `table.feed.renderBody(value,
row)` renders markdown or HTML (React node, Vue VNode or string), clamped by
height; nothing is set as HTML by default. Media reads the media column's
items with the gallery media contract (URLs, lists or `{ url, type, mimeType,
poster, alt, tracks, name }`, same safe URL rule as the gallery). Up to four
images show `loading="lazy"` and `decoding="async"` with `width`/`height`, in
boxes of a fixed ratio (16:10 alone, squares side by side), so nothing shifts
when they arrive. Videos (`type: "video"`, a `video/*` MIME type, or an untyped
video URL; two at most, the others listed as files) show their poster with
native controls, never autoplay and load nothing before they play
(`preload="none"` with a poster, `"metadata"` without); caption `tracks` are
rendered. When the table's gallery media contract is on
(`table.gallery.media.enabled`) for the feed's media column (its `urlColumn`,
else the gallery image column), the source it resolves is used, with
`getMedia` and the type, MIME type and poster columns. Other files are links.
Properties are tags for option columns (colored-tags settings apply) and
formatted numbers, dates and links; empty values are left out.

Settings live in `utils/feed-view.ts` (synced to Vue), are saved with views and
in `<tableId>-feed`, and resolve defaults, then `table.feed`, then the view:
`titleColumn`, `authorColumn`, `dateColumn`, `dateDisplay`, `bodyColumn`,
`mediaColumn` (`null` for none), `propertyColumnIds`, `showPropertyLabels`,
`bodyLines` (4; 0 for the full text), `density` (`comfortable`, `compact`),
`pageSize` (10) and `infiniteScroll` (on; a table or a view turns it off).
Unset columns are guessed by type and name (author, posted/created date,
update/body text, image column; option columns as properties). Both editions
build the same settings panel from `feedSettingFields`. `table.feed.windowing`
is a host option, never saved in views: the number of loaded posts past which
the feed windows (60, `FEED_WINDOW_THRESHOLD`, with `true` or unset), or
`false` to always render every post (e.g. for the browser's find in page).

Pages come from `list` with `page` and `pageSize`, sorted by the date column
descending when the view has no sort, plus `grouping` when the view is
grouped. Both editions subscribe to the same framework-neutral store
(`utils/feed-controller.ts`, synced to Vue; React `useSyncExternalStore`, Vue
`shallowRef`): the first page for a new query, the pages shown so far again
after a mutation (`revision`), the next page appended without repeating
records, one request at a time (calls while one runs are ignored; a newer
query drops older answers). Without `list`, local rows are paged the same way.

With `infiniteScroll`, a sentinel after the posts is watched by an
`IntersectionObserver` whose root is the nearest ancestor that scrolls (a
dashboard widget, a scrolling panel), else the viewport, with a bottom margin
of one root height (`FEED_PREFETCH_MARGIN`): the next page loads a screen
before the end. After each page the sentinel is observed again, so short pages
keep coming until the end is out of reach; at the last page loading stops and
"You're all caught up" shows. A failed page keeps the posts shown, shows "More
posts could not be loaded." (`role="alert"`) and pauses loading on scroll; the
button then reads "Retry" and loads that page again. The "Load more" button
stays as the accessible fallback: visually hidden but in the tab order (shown
when it gets focus) while scrolling loads pages, visible without
IntersectionObserver, with `infiniteScroll` off and after an error, and while a
page loads ("Loading more…", `aria-busy`, disabled yet focusable). Focus stays
on it while pages remain; when the last page removes it, focus moves to the
first new post instead of being lost. A polite live region announces each page
("10 more posts loaded, 30 shown.", "1 more post…", then "You're all caught
up."). With `prefers-reduced-motion` nothing animates: no smooth scrolling
(focus moves scroll instantly), no spinner or skeleton animation.
`aria-setsize` is the host's `totalCount` while pages remain (else -1), then
the number of posts.

Past the windowing threshold, only the posts within one screen above and below
the scroll root's visible part render (`utils/feed-dom.ts`: bisection over the
posts' boxes, recomputed on scroll, resize and each render); the others are
`aria-hidden` placeholders (`[data-feed-placeholder]`) of their last measured
height, cached per record id (never-measured posts use the average), so
positions and the scroll position hold, in document order, and
`aria-posinset`/`aria-setsize` keep the order for assistive technology. The
post holding focus and posts playing a video stay rendered; "Show more" is kept
per record id, so an expanded post comes back expanded. A grouped view (one
level) shows sections headed by the option label and a count, in order of
appearance; windowing works across sections. Loading shows skeleton cards, an
empty feed the table's empty state, a failed first page an error with "Retry".
Renderer contexts gain `groupBy` in both editions. Labels are `feed.<key>`
with English and French defaults. React now hides the table's pagination in
this mode, as Vue does for renderer modes, and its `useOnScreen` treats
elements as visible without IntersectionObserver instead of throwing (the
table no longer breaks without it).

Covered by `tests/feed-view-suite.ts` in both editions (defaults, the
windowing option, videos, posters, captions and the gallery contract, the
store: one request at a time, the end, a failed page paused then retried, the
reload of the pages shown and dropped stale answers, the first load's error,
the live region texts in English and French, the window range and height
cache, the scroll root) and Playwright on both demos: `e2e/feed.spec.ts`
(picker, the "Updates" view, Show more/less by keyboard, Load more with focus
moved at the end, record view, body setting in the URL, groups, short pages
loading until the end, phone and wide layouts, card measures) and
`e2e/feed-loading.spec.ts` (`?example=feed`: pages requested in order while
scrolling, one request each, and announced; the button shown on focus; the
fallback without IntersectionObserver and with loading on scroll off; lazy
images in fixed boxes and a video showing its poster without any video
request; 120 posts with a bounded number rendered, in order, with the right
positions; focus and "Show more" kept across windowing with placeholders of
the expanded height; Retry after a failed page; reduced motion; the view's
module requested only when a feed first shows).

The views demo gains the hidden columns Update, Author and Posted at, and its
`list` now answers one page of `pageSize` rows. Import mapping no longer
guesses "Échéance" by its values alone there, since two date columns fit. Its
"Updates" view turns loading on scroll off (`infiniteScroll: false`) and keeps
the "Load more" path. Both demos add `?example=feed` (`examples/feed.ts`): 120
team posts with photos and a video, ten per page, loaded as you scroll;
`&fail-page=N` fails the first request for page N once, `&delay=ms` slows the
host's answers to show the loading states.

## File tree view

The File tree ships in the core items of both editions (no new dependency),
like the Form view: `withFileTreeRenderer` plugs the built-in renderer in when
`isFileTreeAvailable(table.filetree, columns)` finds a parent column
(configured, or a column named `parentId`, `parent_id`, `parent`, `folderId`,
`folder_id` or `folder`) and hosts list `"filetree"` in `displayModes`;
`table.filetree: false` removes it and a host renderer for `filetree` wins.
The full specification, with its deviations from the draft, is
[docs/FILETREE.md](FILETREE.md).

Everything but the markup is shared and synced to Vue:

- `filetree-model.ts`: settings (`normalizeFileTreeViewConfig`, saved in views
  and `<tableId>-filetree`), parent/name column detection, EN/FR labels
  (`filetree.<key>` overrides), the tree index with Unfiled for orphans and
  cycles, folders-first natural sorting, flattening with ARIA positions and
  status rows (loading, empty, error, Show more, new folder), move validation,
  the keyboard state machine (arrows, Home/End, Enter, Space, `*`, F2,
  Ctrl/Cmd+X/V/A/Z, Delete, Alt+Shift+↓/↑, Shift+F10, type-ahead),
  selection clicks, search helpers, formats (sizes, relative dates, values),
  windowing, the settings fields and the `<tableId>-folder` URL key.
- `filetree-controller.ts`: a framework-neutral store both views subscribe to
  (React `useSyncExternalStore`, Vue `shallowRef`). It loads with the
  `children`, `subtree` and `tree-matches` scopes (`params.scope.kind`,
  `meta.scope: "applied"`), falls back to the capped all-rows loader, pages
  folders by 200, keeps focus, selection, cut, drag, rename and new-folder
  state, and runs moves (optimistic, `actions.tree.move` or `update` of the
  parent column, rollback, undo), `tree.createFolder` or `create`, renames
  through `update` and deletes through `delete`.
- `filetree-dom.ts`: pointer drags (threshold, floating label with the reason,
  not-allowed cursor, auto-scroll, 600 ms hover expansion through the
  controller), desktop file drops for `onDropFiles`, and the details pane
  resize. Both editions attach the same helper to the view's root.
- `filetree.css`: one stylesheet for the treegrid, header, breadcrumbs,
  selection bar, details pane, dialogs and drag label. Tokens resolve
  `--yayaw-*` first (Vue), then the shadcn tokens (React), with dark values.

Each edition renders the same DOM with the same classes: React
(`filetree/filetree-view.tsx`, `filetree-parts.tsx`, shadcn `Checkbox` and
`DropdownMenu`) and Vue (`filetree/FileTreeView.vue` and its parts,
`TableCheckbox`, reka-ui `DropdownMenu`). Move and delete dialogs are native
`<dialog>` elements in both. The render context gained additive fields for
it: `title`, `tree`, `patchRow` (update answering its error), `deleteRow`,
`canDeleteRow`, `media`, `imageColumn`, `selection`, `syncUrl` and `refresh`.
`TableActions.tree` (`path`, `move`, `createFolder`) and the list `meta`
fields (`scope`, `childCounts`, `sizes`, `ancestors`, `truncated`) are typed in
both editions.

Differences imposed by the frameworks: none observable. React hides the
table's page pagination in this mode, as Vue already does for renderer modes.
A Vue dark-theme fix came with it: checked `TableCheckbox`es kept the unchecked
input background in dark mode.

Verification: `tests/filetree-model-suite.ts` (39 tests) runs in both editions
against the demo host of `examples/assets.ts`: settings, detection, sorting,
Unfiled, flattening, Show more, expand-all order and cap, serialization, move
validation, keyboard, selection, formats, labels, icons, search, windowing,
server loading, the client fallback, paging, expand/collapse all with and
without the subtree scope, search with and without `tree-matches`, moves with
undo, rollback and the `update` fallback, cut/paste, drags, rename clashes,
folder creation, deletes, deep links and phone drill-down.
`e2e/filetree.spec.ts` covers both demos (`?example=assets`,
`?example=assets-fallback`): lazy loading with the `children` requests, expand
all with the `subtree` request and collapse all, the details pane, drag and
undo, an invalid drop into a descendant, cut/paste and Move to…, new folder,
F2 rename with a clash, keyboard navigation and type-ahead, search with
ancestors, a deep link, Unfiled in the fallback, phone drill-down and the view
settings. `E2E_REACT_PORT` / `E2E_VUE_PORT` override the demo ports so
checkouts can run the suite side by side.
## Location columns

`location` is a column type in both editions (`TABLE_DATA_TYPES.location`:
form, inline and filter editors `location`). Values are
`{ lat, lng, label?, address? }`; the shared `location-model.ts` also reads
`latitude`/`longitude`, `lon`, GeoJSON points and "lat, lng" text, formats a
place as its label, else its address, else its coordinates (five decimals at
most), and validates stored values (`dataTypeValueError`).

- Cells: a pin and the formatted place (title with the coordinates). Record
  details: "label · address".
- Editor (`LocationEditor` in React, `LocationEditor.vue` in Vue): address
  search, name, latitude, longitude, Clear; inline editing adds Cancel and
  Done, floats above the table (fixed, under its cell, with the table's
  theme) and saves when focus leaves it, like the other inline editors.
  Typing "lat, lng" in the address fills the coordinates. Suggestions come from
  the new `actions.geocode(query, { locale, signal })`
  (`createGeocodeSearch`: 300 ms debounce, three characters, the previous
  request aborted, at most eight results, arrow keys move through them).
  Without `geocode` the editor is an address and coordinates form. React
  reaches the action through a `LocationProvider` around the table (cells,
  record forms, the Form view); Vue through the table context.
  The Form view keeps a place as JSON text in its draft; its conditions see
  that text (use "is empty"/"is not empty"); fixed values do not accept places.
- Filters: `isEmpty`, `isNotEmpty`, `withinDistance` (`values: [lat, lng, km]`,
  haversine) and `withinBounds` (`values: [west, south, east, north]`,
  `west > east` crossing the antimeridian), in `matchesContractFilter` (both
  local engines and the demo hosts) and both filter UIs (labelled number
  inputs). Incomplete rules match every row, as for other types.
- Import: "lat,lng" (also `;` or a space) and JSON places; addresses are
  geocoded before planning when the host has `geocode` (one request at a time,
  first suggestion), otherwise they are `invalid_location` errors. Export:
  formatted values are the label, raw values "lat,lng" (read back by import).
- Connectors: `normalizeSyncValue(value, "location")` compares places as
  "lat, lng" text; Notion rich text and Google Sheets cells receive that text.
  Values pulled back are stored as that text (the table reads it as a place;
  the label is not kept). A sheet with separate latitude and longitude columns
  is not combined into one place: map one text column.

## Map view

Maps ship as optional registry items, like charts: `yayaw-table-map` (React,
[mapcn](https://www.mapcn.dev/) — its `Map`, `MapMarker`, `MarkerContent`,
`MapPopup` and `useMap` — on MapLibre GL; the item depends on
`https://mapcn.dev/r/map.json` and `maplibre-gl`, and the demo vendors that
file as `src/components/ui/map.tsx`) and `yayaw-table-vue-map` (Vue, MapLibre GL
directly: mapcn-vue installs Tailwind and shadcn-vue components the Vue
edition does not use, so the item draws the same markers, clusters, popup and
controls with its own CSS). Both views load lazily. Hosts pass
`displayModeRenderers: { map: mapRenderer }` and list `"map"` in
`displayModes`; `table.map: false` removes the mode.

The shared `map-model.ts` owns everything but the drawing:

- Settings (saved views, `<tableId>-map`): `locationColumn` (first location
  column by default), `titleColumn`, `colorColumn` (select, multi-select or
  tag columns), `popupColumns` (three by default), `showPopupLabels`,
  `cluster` (default on), `style`, `initialView` (`fit`, or `saved` with
  `center`/`zoom`: choosing it stores the map's current position),
  `searchOnMove`. The settings panel is `mapSettingFields` (fields plus the
  popup properties list) in each edition's `ViewSettingsPanel`.
- Host options in `table.map`: `style`, `styles`, `attribution`, `maxRows`,
  `workerUrl`. No tiles and no keys ship; without a basemap the map is blank
  and a notice names `table.map.style`. The worker comes from unpkg for the
  installed MapLibre version (mapcn's default) unless `workerUrl` is set.
  MapLibre 6's worker imports `./maplibre-gl-shared.mjs` relative to its own
  URL, so a self-hosted `workerUrl` needs both `maplibre-gl-worker.mjs` and
  `maplibre-gl-shared.mjs` (from `node_modules/maplibre-gl/dist/`) in the same
  folder; the shared suite checks where the sibling resolves and the React
  tests check that the installed worker imports nothing else.
- Markers (`mapMarkers`): records with a place; the others are counted
  ("1 record without a location"). Colors: the option's `color`, else its tag
  hue (also when the table shows plain tags). Clustering: a MapLibre GeoJSON
  source (`mapFeatureCollection`, radius 50, up to zoom 14) with an invisible
  layer; `attachMapItems` reads the rendered clusters and records and both
  editions draw them as DOM buttons (MapLibre markers), so every marker is
  focusable and has a name. A cluster zooms to its expansion zoom.
- Popup: title (the title column as the table shows it), place, the popup
  properties formatted like the table (`mapPopupProperties`), a close button and "Open", which opens the record
  like a row click (the details drawer in the demo). Clicking the map
  background closes it (`isMapBackgroundClick`: MapLibre reports marker
  clicks as map clicks). Opened from the keyboard, focus moves to "Open";
  Escape closes it and returns to the marker.
- Area: `boundsFromMap` normalizes the view (wrapped longitudes, whole world);
  "Search this area" appears after a user move (or `searchOnMove` searches at
  each move) and `loadMapRows` sends `scope: { kind: "bbox", field, west,
  south, east, north }` with the usual list parameters. We kept the existing
  `kind` discriminant of list scopes (`dateRange`) rather than a `type` key.
  A host that filters by it answers `meta.scope: "applied"`; otherwise
  `loadScopedRows` filters the loaded rows (`rowInScope`), capped at
  `maxRows`, with a notice. The demo host applies it and records the scopes
  it receives for the end-to-end tests.
- List panel: the records in view (`markersInBounds`), at most 300, beside the
  map on desktop and as a bottom sheet under 768 px (closed by default there);
  hovering or focusing a row highlights its marker and the reverse; clicking a
  row flies to the marker and opens its popup.
- Themes: light and dark basemaps follow `.dark`/`.light` or `data-theme` on
  the document, else the system preference (mapcn's rule, reproduced in Vue).

Verification: `tests/map-model-suite.ts` runs in both editions (parsing,
formats, distances and bounds, filters, editor drafts, geocoding search,
import/export, connector text, settings, basemaps, markers and colors,
clustering input and items, bbox scope with server and browser filtering,
notices, labels, the cluster layer on a fake map, the settings panel).
`tests/fixtures/data-types.json` covers the new type. `e2e/map.spec.ts` runs on
both demos with WebGL through SwiftShader (tiles and the unpkg worker and its
`maplibre-gl-shared.mjs` served locally): markers and the cluster, popup and Open, keyboard, color by status,
settings in the URL, the list panel and highlights, "Search this area" sending
a bbox scope, the inline editor with geocoder suggestions, and the phone
layout.

## Row click and display mode picker

Both editions resolve `rowClickMode: "default"` the same way: the edit form
with `enableRowClickEdit`, the link of a row-link column, otherwise the record
view (`onOpenDetails`, else the built-in details derived from the columns).
`details: false` removes the built-in view. The view menu offers display modes
in a select (React Base UI Select, Vue `TableSelect`); compact toolbars and
touch drawers keep the wrapping buttons. The create button reads the
`add_an_item` key in both editions.

## View tabs

Both editions show saved views as tabs on wide toolbars once a table has at
least one (`table.viewTabs`, default on, `{ maxVisible }` default 4). The
shared `view-tabs.ts` decides which views are tabs and which go under "More",
keeping the active view visible. The default view is always the first tab;
each tab shows its layout icon and the modified dot. "+" opens the save
dialog, which offers the layout of the new view (the current one by default);
creating a view in another layout switches to it. With tabs, the view menu
trigger is an icon button labelled "Views and settings". Compact toolbars and
touch layouts keep the named trigger. `tests/view-tabs-suite.ts` runs in both
editions and `e2e/view-tabs.spec.ts` covers both demos.

## Toolbar hierarchy

Both editions split the toolbar into a view switcher on the left and the view
settings on the right. The switcher shows tabs on wide toolbars (default view
included from the start) with a "View actions" chevron for the write actions,
and on compact toolbars a named trigger whose menu lists the views (scrolling,
name filter beyond seven) followed by the same actions. "View settings" holds
presentation only (layout, density, properties, filter, sort, group, cards)
and a "Data" section with Export, Share and, on compact toolbars, the
application toolbar actions. Search is a field on wide toolbars and a button
that opens it on compact ones. There is no separate data actions drawer.

## Data destinations

Both editions read `actions.destinations` and list them in the View settings
"Data" section: sync destinations (kind `"sync"`, alias `"export"`) under
Sync, share destinations under Share after "Copy link" (`table.share: false`
hides the link; without share destinations Share copies the link directly). The shared
`data-destinations.ts` groups them (declared order, first id wins, `hidden` and
`requiresSelection` honoured), normalizes the view's query into the `list`
shape and runs one destination at a time, turning failures into a message.
React icons are nodes, Vue icons are components; both default to a send icon.
`tests/data-destinations-suite.ts` runs in both editions.

## Export screen

Both editions open the same Export screen from the Data section (format,
records, columns, values, file name) and hand the choice to the shared
`export-model.ts`: `runExport` sends an `ExportFileRequest` to
`actions.exportFile` when the host builds files, otherwise it loads the rows
(or uses the selection), builds the matrix with the shared value formatting
and downloads a CSV or prints a page from a hidden frame. The request carries
each column's type, options and formats and the table `locale`, so a server
file "as displayed" can match the table. `availableExportFormats`
offers Excel only with a writer and honours `table.exportFormats`.
`tests/export-model-suite.ts` runs in both editions.

The bulk bar's Export opens this screen with the selection chosen, in both
editions (React through the menu open-to-view atom, Vue through
`optionsRequest`), keeping the selection so it is what gets exported.

## Data button

Both editions put Export, Connect and Share in a Data menu opened from a
database icon next to View settings (React `TableDataMenu` with its own
open-to-view atom, Vue a second `ToolbarMenu` whose `optionsRequest` handling
routes `export` to it). The bulk bar's Export opens its Export screen.
Destinations of kind `"connect"` (aliases `"sync"`, `"export"`) list under
Connect.

## Connect schedules

A Connect destination that declares `schedule` (`load`, `save`, optional
`status` and `frequencies`, all receiving the destination context, so the
schedule belongs to `viewId`) gets a clock button on its row in both
editions; the row itself still runs it. The button opens a screen in the Data
menu (React a `StackMenuView` named `schedule:<id>`, Vue `dataView
"schedule:<id>"`, back returns to Connect) with the same fields: frequency,
minute (hourly), time (daily, weekly, monthly), day of the week in the
locale's order, day of the month or last day (shorter months use their last
day), start date and time zone (browser default, `Intl.supportedValuesOf`
when available). Only the fields of the chosen frequency are shown. The shared
`schedule-model.ts` validates the settings, computes the next run with
`Intl.DateTimeFormat` offsets (skipped times move forward, repeated times run
once), describes the schedule and holds the English and French labels; both
editions read `schedule.<key>` host translations first. `table.schedule: false`
hides scheduling. `tests/schedule-model-suite.ts` runs in both editions and
`e2e/view-tabs.spec.ts` saves and reopens a weekly schedule on both demos.

## Server connectors

The Notion and Google Sheets connectors are framework-agnostic server modules
in `src/components/ui/yayaw-table/connectors/` (`connector-model.ts`,
`notion.ts`, `google-sheets.ts`). `bun run contracts:sync` copies them to
`packages/yayaw-table-vue/src/connectors/`, so both editions ship identical
files as optional `registry:lib` items (`yayaw-table-connector-*` and
`yayaw-table-vue-connector-*`), excluded from the table items. They have no
UI and no framework code; the host provides credential storage,
authorization, server entry points and workers ([connectors](connectors.md)).
`tests/connectors-notion-suite.ts` and `tests/connectors-google-sheets-suite.ts`
run against both copies with a fake `fetch` and clock.

The two-way sync engine `connectors/sync-engine.ts` (`planSync`,
`applySyncPlan`, `nextSyncState`, `summarizeSyncPlan`, `normalizeSyncValue`,
`hashSyncValues`, `toSyncMapping`) is synced the same way and ships in both
connector items of each edition, next to `connector-model.ts`. It is pure:
directions (`push`, `pull`, `two-way`), per-column three-way merge with
`baseValues` (record hashes otherwise), conflict rules (`table-wins` default,
`target-wins`, `latest-wins`), delete policies (`ignore`, `flag` default,
`propagate`), adoption by key and duplicate reporting behave identically in
both editions. The provider reads (`readNotionDatabase`, `readSheetRows`,
`sheetValuesToRecords`, `fromNotionPropertyValue`) and sync targets
(`createNotionSyncTarget`, `createSheetSyncTarget`) live in the provider
modules. `tests/connectors-sync-engine-suite.ts` runs in both editions, and
the Notion and Google Sheets suites cover reads, sync targets and unchanged
round trips of every column type.

## Connector screens

A Connect destination that declares `connector` (`targets`, optional
`allowTargetInput`, `describe`, `modes`, `load`, `save`, `push`, `labels` and
`help.notShared`) opens one screen in the Data menu instead of running `run`,
in both editions (React a `StackMenuView` named `connector:<id>`, Vue
`dataView "connector:<id>"`; back and Done return to Connect; the schedule
clock stays). The screen is driven by the shared, framework-neutral
`createConnectorFlow` state machine in `connector-flow.ts`, and both editions
render the same `connectorScreenFields` list through `ViewSettingsPanel`
(new optional `heading` and `inline` fields; React `after`, Vue
`#after-<id>` slot), so long selects open as choice lists in the drawer on
touch layouts. Order: target (with the optional paste input), child, visible
or all columns, one mapping per column (same header first, type-compatible
fields first, a new field when `allowNewFields`, or Don't send), key field
("Yayaw ID" by default), mode with its one-line explanation when several are
offered, and records (all in the view or the selection). Send validates,
saves the settings with `save`, pushes with scope-aware context
(`scope`, the sent `columns`, and for a selection `selectedRowIds` and
`loadRows` limited to the selected records), then shows the counts, first
failures, warnings and truncation with Done and Send again. Errors (thrown,
or returned as `{ error: { code, details } }`) show inline with a localized
message; `not_shared` names `details.serviceAccountEmail`. Labels are English
and French in the shared model, overridable with `connector.<key>`.
`table.connectors: false` keeps the row running `run`.
`tests/connector-flow-suite.ts` runs in both editions and
`e2e/connectors.spec.ts` covers mapping, send and send again, selected
records, a target that is not shared and the phone drawer on both demos (the
in-memory "Spreadsheet" connector in `examples/views-spreadsheet.ts`).

## Data › Import and column mapping

Both editions list "Import" in the Data menu between Export and Connect when
the table can create rows (`allowCreate` and `actions.create`), update them
(`allowEdit` and `actions.update`) or import in bulk
(`actions.import.importRows`), unless `table.import` is `false` (declared in
the React config and the Vue `types.ts`; default on). React opens a
`StackMenuView` named `import`, Vue `dataView "import"`; Cancel and Done
return to the Data menu. The screen is driven by the shared, framework-neutral
`createImportFlow` state machine in `import-flow.ts` over the pure
`import-model.ts` (both synced to Vue):

- Source: a CSV drop zone and file picker (`decodeCsvFile`: UTF-8, else
  Windows-1252), pasted text, and the host's `actions.import.sources`
  (`{ id, label, description?, load(context) }` returning headers and rows or
  CSV text; used later by Notion and Google Sheets imports).
  `actions.import.csv: false` hides CSV.
- Mapping: `parseCsv` (RFC 4180, BOM, CRLF/LF, delimiter detected among
  `,` `;` tab `|`, blank lines ignored) with a separator select and a "First
  row is headers" checkbox; one row per source field from
  `importMappingRows` with a sample value, a badge (the column's type, or how
  many of the first 20 values won't convert), and a select of the table's
  columns plus Ignore; `defaultImportMapping` matches by header or column id
  (accents, case and separators ignored, same type family first, then the one
  remaining column that converts the field's values); "Match existing records
  by" (none by default unless a mapped column is an id); a preview of the
  first 5 rows as the table will show them (option labels, number and date
  formats), invalid cells highlighted with their error as a title. Choosing a column already taken moves it.
- Values (`coerceImportValue`): numbers with decimal commas, grouping,
  currency symbols and percents (the column's `numberFormat` decimal
  separator and percent base win; a single ambiguous separator follows the
  locale), dates as ISO, day-first or month-first (`detectDateOrder` over the
  whole column, else the locale) and Excel serials (`YYYY-MM-DD`, or ISO with
  a time), checkboxes (true/false, yes/no, oui/non, 1/0, x), select and
  multiSelect by option value or label (accents and case ignored; unknown
  options are errors unless `allowNewOptions`), links, emails and JSON.
  Empty cells are `null`; required columns reject them on creates, while
  updates leave empty cells unchanged.
- Review (`planImport`, `summarizeImport`): rows whose key matches a record
  update it, the others are created; a key repeated in the file is an error
  on its later rows. Counts of rows to add, to update and with errors, the
  first errors ("Row 5, Status: not one of the options"), and "Skip rows with
  errors" (on by default; off blocks Import). Keys are looked up with
  `actions.import.lookup({ columnId, keys })` or, by default, all the table's
  records loaded through `list` with an empty query (the loaded rows without
  `list`).
- Run (`runImport`): batches of `batchSize` (50) through
  `actions.import.importRows(batch, context)` when provided, else the
  table's `create` and `update` actions; a progress bar and Stop (between
  batches); failures are collected per row and only 401/403 or
  `unauthorized`/`forbidden`/`invalid_credentials` errors stop the import.
  The result shows added, updated and failed rows with the first failures,
  then Done or "Import another file"; the table refreshes (React invalidates
  `["tableData", tableId]`, Vue `context.refresh()`).

Labels are English and French in the shared model, overridable with
`import.<key>` translations. On touch layouts every select opens as a
full-screen choice list in the drawer; the file line and header checkbox
(`ViewSettingsPanel` `intro`, Vue `#intro` slot) hide while a list is open.

The mapping UI is the reusable `ColumnMapping` component (React
`components/toolbar/column-mapping.tsx`, Vue
`components/toolbar/ColumnMapping.vue`): direction-agnostic `rows`
(`ColumnMappingRow` in the shared `field-matching.ts`: label, value, options,
sample, badge), `before` and `after` settings, an optional `keyField` and
`preview`. The connector push screen now renders through it
(`connectorMappingSections` splits its screen fields), and both screens share
`matchFieldsByName` (`defaultConnectorMapping` keeps its behaviour, with
same-type fields now preferred over merely compatible ones).
`tests/import-model-suite.ts` runs in both editions and `e2e/import.spec.ts`
covers upload, auto-mapping, Ignore, the key column, the error count, import
with errors skipped, the new and updated rows in the table, a re-import that
only updates, blocking without skipping errors, and the phone drawer, on both
demos (`e2e/fixtures/import-projects.csv`). The views demo's `list` now
returns copies of its records, as a server would.

## Sync in the connector screen

A connector may declare `directions` (default `["push"]`), `conflictRules`
(default all three), `preview(settings, context)` and `sync(settings,
context)`; pull and two-way are offered only with `sync`, and
`table.sync: false` (React config and Vue `types.ts`; default on) keeps push
only. The string unions (`SyncDirection`, `ConflictRule`, `DeletePolicy`) are
mirrored in the shared `connector-flow.ts` so the browser bundle never imports
the server `sync-engine.ts`; `toSyncPreview(plan, { limit, rowLabel })` and
`toSyncRunResult(result, plan)` turn the engine's plan and result into what
`preview` and `sync` return (structural types, no import). `ConnectorSettings`
gains `direction`, `conflictRule` and `deletePolicy` (optional in the type,
always set by the screen: preset, else remembered when still offered, else
push, table-wins and flag).

Both editions render the same `connectorScreenFields`: target and child, then
"Direction" (Send to <target> / Import from <target> / Keep both in sync, only
with more than one direction), columns, the mapping, key field, then for push
mode and records exactly as before (push still calls `push`), and for pull and
two-way the conflict rule (two-way only, with its one-line explanation) and
"Deleted records" (Only flag, Ignore, Delete on the other side, each
explained). Pull and two-way map each target field to a table column
(`field:<name>` rows, "Don't import"/"Don't sync"; picking a column already
used frees it), with the field's first `sample` value and a badge counting
samples the column cannot take (`coerceImportValue` from the import model);
two-way also lists new fields the sync will add. "Delete on the other side"
shows a confirmation checkbox; "Sync now" (or "Import now") stays disabled
until it is checked and, when the connector can preview, until a preview of
the current settings (`connectorSyncBlocker`; any change clears the preview).
"Preview changes" shows a two-column grid (In <target> / In this table:
create, update, delete), flagged and unchanged notes, a duplicates warning
and the first conflicts with both values and which one wins. A sync always
covers the view (never the selection), saves the settings, reports "In
<target>: … · In this table: …" with failures, flagged records, truncation
and a stop reason, offers Done and "Preview again", and reloads the table
(React invalidates `["tableData", tableId]`, Vue `context.refresh()`).

Data › Import lists each connector that can pull as a source ("From
<destination>") that opens the connector screen with the direction preset to
pull (React `StackMenuView` `connector-pull:<id>`, Vue `dataView
"connector-pull:<id>"`, back and Done return to Import). The schedule summary
of a connector destination ends with its saved direction when there is a
choice ("Every day at 09:00 (Europe/Paris) · Keep in sync";
`connectorScheduleSuffix`, a new optional `summarySuffix` of the schedule
panels). Labels are English and French, overridable with `connector.<key>`.

`tests/connector-sync-suite.ts` runs in both editions (directions and rules,
settings defaults, fields per direction, validation, mapping orientation,
preview and confirmation, preview and result formatting, schedule suffix) and
`e2e/sync.spec.ts` covers, on both demos, a two-way preview with its counts
and conflict, the sync and an empty second preview, a pull importing the
sheet-only rows, the confirmation and preview required to delete, and the
Import source. The demo "Spreadsheet" connector has a "Live projects" sheet
synced once and then edited on both sides, planned and applied by the real
`planSync` and `applySyncPlan` with in-memory adapters.

## Conflict rules in code

The sync engine (`connectors/sync-engine.ts`, copied to the Vue connector
items) takes optional `ownership`, `columnRules` (`ConflictRule`, `merge`,
`manual`) and `resolveConflict` inputs, applied per conflicting column in that
order before the global `conflictRule`; it reports `overridden` columns,
`resolution`/`source`/`value` on each conflict and keeps manual conflicts in
`SyncState.pendingConflicts`, settled by `resolvePendingConflicts` and
`applyConflictResolutions`. `validateConflictConfig` checks a configuration
against a mapping and direction. Hosts that pass none of these inputs get the
same plans as before.

The shared `connector-flow.ts` adds the declared, display-only
`connector.conflicts` (`ownership`, `columnRules`, `lock`, `allowManual`) and
the optional `listConflicts(settings, context)` and
`resolveConflicts(resolutions, settings, context)`; `SyncPreview` gains
`overridden`, `overriddenCount` and `pendingConflicts`, and each preview
conflict an optional `source` and `value` with `resolution` widened to
`table | target | merged | custom | manual | skipped`. The flow state gains
`conflicts`, `conflictsOpen` and `resolvingConflicts`, with
`loadConflicts`, `showConflicts` and `resolveConflicts` actions; conflicts are
listed after the target is described, after a sync and after each
resolution. Both editions render the same helpers:
`connectorConflictRulesView` ("Rules set by your app", lock icon and hint
when `lock` is set; under the conflict rule in two-way, under "Deleted
records" for a pull with ownership only), `describeSyncPreview` (the
"Changed on both sides" and "Kept from the side that owns them" groups, each
line labelled "<side> wins", "Owned by <side>", "Merged" with its result,
"Needs your decision", "Decided by your app" or "Left as is for now") and
`describePendingConflicts` ("Conflicts to resolve (N)" entry on the settings
and on the result, a list with "Keep table value" / "Keep <target> value" per
conflict and both bulk actions, "All conflicts are resolved." and Back).
Values are formatted by column type in the table's locale
(`formatSyncValue(value, t, { type, locale })`). A locked conflict rule is a
disabled select in both editions (`ViewSettingField.disabled` in React, the
Vue settings panel's `disabled` field, passed to `TableSelect` and the
compact button), and `flow.update` ignores it. React renders the list in
`connector-panel.tsx`; Vue in `ConnectorConflicts.vue` and the rules in
`ConnectorAppRules.vue`. A resolution reloads the table like a sync (React
`onSynced`, Vue `synced`). Labels are English and French, overridable with
`connector.<key>`.

`tests/connectors-sync-engine-suite.ts` runs in both editions (precedence,
ownership in each direction with drift write-back, merge, every resolver
outcome and a throwing or asynchronous resolver, the pending-conflict
lifecycle including partial reads and blocked rows, resolution, failure and
idempotence, validation) and `tests/connector-sync-suite.ts` covers the
rule sentences, the locked select, preview labels, value formatting and the
list, resolve and reload flow. `e2e/sync.spec.ts` runs on both demos: the
locked rules list, the preview labels ("Owned by Spreadsheet", "Needs your
decision"), resolving one conflict by keeping the sheet value (the table
updates) and resolving all at once. The demo "Live projects" connector owns
prices in the sheet, leaves status conflicts to a person and lets the table
win names. The demo has no multi-select column (adding one would change the
Form view and other end-to-end tests), so "Merged" is covered by the unit
suites only.

A column a record never synced (a record adopted by key, a column mapped
after the first run, or unknown on one side then) is filled from the side with a value whatever the
rules, reported in `SyncPlan.initialized`, counted by `summarizeSyncPlan` and
returned by `toSyncPreview` as `initialized`; `describeSyncPreview` adds the
note "N empty values will be filled in from the other side." in both
editions (`filledNote`, `filledNoteOne`). Hash-only links store their hashed
`columns`. The shared engine suite covers each rule and direction, owned and
manual columns, adopted records, both-empty and removed columns, a field added by Prepare,
partial reads, hash-only and legacy links and idempotence.

## Connector target health

The shared `utils/connector-schema.ts` (synced to the Vue source root by
`contracts:sync`, imported by `connector-flow.ts`, pure and safe on the
server) holds the type compatibility matrix per direction
(`typeCompatibility`), field resolution by id, name, then shifted sheet
position (`resolveMappedField`, `keyIndexShift`, `upgradeMapping`),
`checkTargetSchema` with its issue codes and additive fixes,
`schemaBlocksRun`, `schemaRenames`, `missingOptions` and `notionColorFor`.
Both editions' connector items gain the same server functions:
`notionTargetSchema`, `prepareNotionDatabase`, `planNotionPrepare`,
`listNotionPages`, `createNotionDatabase`, `planNotionDatabase`,
`sheetTargetSchema`, `getSheetTargetSchema`, `prepareSheet` and
`planSheetPrepare`; Notion pushes, reads and sync targets resolve properties
by `propertyIds` / `SyncField.fieldId` first, and reads also return formulas,
created and edited times and unique ids.

`connector-flow.ts` adds `fieldId` / `fieldIndex` to mapping entries,
`keyFieldId` / `keyFieldIndex` to settings, `id` / `index` to fields,
`provider` to schemas and `options` to columns, the optional connector
functions `checkSchema`, `prepareTarget` and `createTarget` (`label`,
`parents`, `create`) and `help.missingTarget`. The flow state gains
`schemaReport`, `checking`, `renames`, `prepareOpen`, `preparing`,
`prepared`, `createOpen`, `createParents`, `creating` and `refreshing`, with
the actions `checkSchema`, `showPrepare`, `prepare`, `updateMapping`,
`refreshTargets`, `showCreate` and `createTarget`. Both editions render the
same helpers: `describeSchemaReport` ("Target check" grouped by severity,
"Update mapping", "Prepare Notion database" / "Prepare sheet", "Fix this
first: …"), `describeSchemaFixes` (the confirmation lines),
`connectorSchemaBlocker` (Send, Sync now and Preview disabled),
`connectorFieldOptions` / `connectorScreenFields` (disabled choices with the
reason, "used by", the Notion page title row first, "Create one from this
table’s columns…" in the target list) and `connectorNewTargetColumns`. Both
toolbars pass static column options (`connectorColumnOptions`). React
renders `TargetCheck`, `PrepareConfirmation`, `TargetTools` and
`CreateTargetForm` in `connector-panel.tsx`; Vue `ConnectorTargetCheck.vue`,
`ConnectorCreateTarget.vue` and the confirmation and tools in
`ConnectorPanel.vue`. Disabled options are a new optional `disabled` on
choices of the React `ViewSettingField` (select and phone radio list), the
Vue settings panel (radio list) and Vue `TableSelect`. Labels are English
and French, overridable with `connector.<key>`.

`tests/connector-schema-suite.ts` runs in both editions (the compatibility
matrix, every issue code per direction, status options, pull samples, key
types, providerless targets, id / name / position resolution, sheet renames,
colors, and the screen flow: rename and Update mapping, a blocking issue
stopping Send, Prepare and re-describe, disabled choices and the title row,
creating a target, a host `checkSchema`, refreshing targets).
`tests/connectors-schema-health-suite.ts` runs against both copies of the
server modules with a fake `fetch` (one idempotent Notion PATCH that never
deletes, renames or retypes, a push following a renamed property, formula
reads, database creation not retried, page listing, sheet sampling, an
idempotent `prepareSheet`, and sheet writes following a renamed header:
`pushRowsToSheet`, the sync target and `prepareSheet` write the renamed
column in place without adding a header, and an unusable saved position
throws `field_missing` before anything is written). Sheet writes resolve
headers with the shared `resolveSheetColumns` rule (by header, then by the
saved position shifted like the key column when the header there is not
mapped elsewhere), the same rule as the check's `field_missing` issue. `e2e/schema-health.spec.ts` runs on both demos:
the demo "Notion" destination's "Live projects" database drifted (Price
renamed Cost, Progress became a Select, two Category options and "Yayaw ID"
missing, a formula and a people property), so the check lists each issue,
Send is disabled with the reason until Progress is not sent, disabled
choices say why, Update mapping and Prepare clear their issues, and "New
database from this table’s columns…" creates a clean one.

## Form view

The Form display mode ships in the core items of both registries: it needs no
dependency beyond the shadcn primitives and `react-day-picker` already in the
React item, and Reka UI with `@internationalized/date` (its date model) in the
Vue item, unlike the calendar. Both editions plug a built-in `formRenderer` into
the display mode renderers (`withFormRenderer`) when the table can create
records (`actions.create` and `allowCreate !== false`) and `table.form` is not
`false`; otherwise the registry withholds the mode like any renderer mode
(`requiresRenderer`). A host renderer passed for `form` wins. `table.form` may
also be an object of default settings.

The shared `form-view.ts` (synced to Vue) holds the model: settings
normalization (`normalizeFormViewConfig`, saved in views as `config.form` and
in the `<tableId>-form` URL key), eligible columns (`formColumns`: text,
textarea/code, number, date, select/tag, multi-select, boolean, URL/image;
JSON, custom, dynamic and computed columns are excluded and listed in the
form builder, and so are columns forms may not write, see "Columns a form may
ask" under "Form builder"), questions as an ordered array of `{ id, columnId, label, help,
placeholder, required, optionLabels }` with a stable `id` (room for future
conditions and a step-by-step layout; texts may be localized, and consents and
hidden fields join the array, see "Form languages, consent and hidden
fields"), move/toggle/update helpers, draft coercion, validation
codes (`validateFormValues`), the record sent to `create` (fixed values of
columns not asked, then answers), English and French labels overridable with
`form.<key>` translations (React accepts flat `"form.submit"` keys), and the
public-link contract.

Settings: the form is edited in the form builder ("Edit form" above the Form
view, or View → Form settings, which now summarize the form); see "Form
builder". Texts are saved on blur or Enter.

The standalone component (React `form/yayaw-table-form.tsx`, Vue
`form/YayawTableForm.vue`) takes `columns`, `form`, `onSubmit(values, {
context }) → { ok: true } | { errors, message }`, optional `validate`,
`onSuccess({ values, redirectUrl })` (the host decides whether to redirect),
`translations`, `translate`, `locale`, `context`, `closed` and host fields
(React `extraFields`, Vue `extra-fields` slot). It imports no nuqs, jotai,
TanStack Query or table provider, and renders one question per
`FormQuestionField` / `FormQuestion.vue` so a stepper can reuse it. Questions
use the controls the table's forms are built from, not native widgets: React
shadcn `Field`, `Input`, `Textarea`, the base-ui `Select` with the create
form's `FormSelectContent`, `Checkbox`, `Switch`, and a `Popover` + `Calendar`
date picker (the registry points it at the table's internal calendar copy);
Vue the same shapes with Reka `Select`, `Checkbox`, `Switch`, `Popover` and
`Calendar` (`@internationalized/date` is now a Vue registry dependency). The
create-form field components themselves (`TextField`, `SelectField`, …) are
not reused: they need the table provider and a TanStack form field and carry
no `aria-describedby`/required hooks. Select and multi-select options render
as the column's tags when `displayVariant: "tag"` (colored per
`coloredTags`); dates show in the date part of the column's format, else in
the form's language (`formDateDisplay`, `formWeekStart` for the calendar) and
are stored as `YYYY-MM-DD`; numbers are
typed plainly and shown with the column's `numberFormat` once the field is
left (`formNumberDisplay`); yes/no columns are a switch row. Accessibility is
the same in both: labels, `required`/`aria-required`, help and error ids in
`aria-describedby`, `aria-invalid`, an error summary alert (the only live
region), focus on the first invalid question's control (`data-form-focus`),
and the calendar opens on the picked day or today. The form is a centered
card (640px max) with a bordered header; "sent" and "closed" use the table's
empty-state layout (icon, title, message, "Submit another response").

Public links: optional `actions.formLinks` (`status`, `publish(viewId)` —
the snapshot is built by the host, see "Form conditions and steps" —,
`unpublish`, `setAcceptingResponses`) adds a "Share form" button
to a slim bar above the form of a saved view (unsaved state asks to save
first). It opens a popover (React `StackMenu`/`ResponsiveMenu`, Vue
`ToolbarMenu`), a bottom drawer below 768px like the Data menu: "Publish to
the web" switch, the read-only public link with Copy (icon button, "Link
copied" for two seconds) and Open icon buttons, "Accept responses" switch and
"Update public form" with its hint.
Republishing is explicit so unsaved edits never go live. `publicFormSnapshot`
keeps only the asked columns (id, header, type, options and, when set,
`displayVariant`, `coloredTags`, `numberFormat`, `dateDisplayPreset`,
`dateFormat`), the form settings and
the fixed values (kept server-side); `acceptPublicFormResponse` re-validates a
response against the snapshot, drops other fields and adds the fixed values;
`formSettingsFromView` reads a saved view. The demo host
(`examples/form-links.ts`) stores snapshots and responses in localStorage and
serves `?example=form&form=<viewId>`; the views demo ships a "Request" form
view and `?example=form` shows the standalone component.

Renderer context additions (both editions): `createRecord(values)`, `viewId`,
`formLinks` and `coloredTags` (the table setting, applied to the form's tags
unless a column sets its own); the settings context (and so the render
context) also has `formFields`, the fields of the table's create form when the
host declares them. `tests/form-view-suite.ts` runs in both editions and
`e2e/form.spec.ts` covers configuring questions in the form builder (order,
required, help text),
error focus, the number format shown after typing, success and the new row in
the table, picking a date in the standalone form, publishing, copying and
opening the link, a public response reaching the table, closing responses,
unpublishing, the save-first prompt and the standalone page, on both demos.

## Form conditions and steps

Both editions share one conditions engine, `utils/form-conditions.ts` (synced
to Vue as `form-conditions.ts`; pure, no UI dependency, usable on a server).
A rule is `{ id, when, then }`: `when` is `{ join: "and" | "or", items }`
where items are conditions `{ fieldId, operator, value? }` or nested groups
(the engine supports any depth, the editors offer one nested group); `then` is
`{ action: "show" | "hide" | "require" | "set", questionIds? | fieldIds?,
value? }`. Operators by type — text: `is`, `isNot`, `contains`,
`notContains`, `startsWith`; number: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`,
`between`; date: `on`, `before`, `after`, `between`, `inLast`/`inNext` (N
days); select: `is`, `isNot`, `isAnyOf`, `isNoneOf`; multi-select:
`containsAny`, `containsAll`, `containsNone`; checkbox: `isChecked`,
`isUnchecked`; `isEmpty`/`isNotEmpty` for all but checkboxes. Text compares
trimmed and case-insensitively, select values as text, dates by day
(`YYYY-MM-DD…` or `Date`), numbers typed as text are coerced.

`evaluateForm(rules, values, fields, { now, mixed, groups, context })`
returns `visible`, `hidden`, `required` (static `required` or a matching
`require`, only while visible), `setValues` and `matched`. A target of any
`show` rule is hidden until one matches; `hide` wins; hidden answers are
cleared before other conditions read them, so chains settle (bounded loop).
`groups` hides children with their parent (a section's questions); `mixed`
fields never match. `validateRules` reports `missingField`, `unknownField`,
`operator` (operator/type mismatch), `missingValue`, `unknownOption`,
`emptyGroup`, `noTargets`/`unknownTarget`, `selfReference`, `cycle` and, with
`layout: "steps"`, `laterQuestion` for `require`/`set` rules reading a later
question (`show`/`hide` may). `sanitizeRules` keeps the JSON structure of
unfinished rules (settings save them while they are edited);
`normalizeRules` returns the rules that can act and the dropped ones with
their reason; `detectRuleCycles` drops the rule that closes a loop.
`describeRule` builds summaries from translatable words.

Form view (`config.form.rules`, conditions on question ids, effects on
question or section ids): the page layout hides questions and sections by
rule and marks `require`d questions (label asterisk, `required` and
`aria-required`); `validateFormValues(questions, values, evaluation)` skips
hidden questions and uses the rules' required set; `formSubmission` removes
hidden answers and applies `set` values; `acceptPublicFormResponse` evaluates
the snapshot's rules on the server (required if visible, hidden answers
ignored, `set` applied). `publicFormSnapshot` keeps the rules that can act,
sections, `layout` and `review`.

Section breaks are items of `questions`: `{ id, kind: "section", title?,
description? }` (form builder: "Add" → "Add section", move, edit title and
description, remove; removing drops rules left without target). The page
layout renders them as headings.

Steps layout (`form.layout: "steps"`, `form.review` for a final review):
`formSteps(settings, evaluation)` gives one step per visible question, or one
per section (questions before the first section form a "start" step), and
skips what the rules hide; `formStepOptional` offers Skip when no visible
question of the step is required. React renders it with the shadcn
Questionnaire (Base UI flavour, `src/components/ui/questionnaire.tsx`, the
registry item lists `questionnaire` in `registryDependencies` and
`@shadcn/react` in `dependencies`); Vue with a copy of the shadcn-vue
Questionnaire under `components/questionnaire/` (Reka `Primitive`, styled
with the registry's CSS, excluded from lint as vendored code; the Choice,
Input and Error parts are not shipped). In both, the Questionnaire provides
the fieldset per step, hidden/inert inactive steps, the progress (named
progressbar with our "Step X of Y" `aria-valuetext`), Back/Next/Skip/Submit
visibility and ArrowLeft; navigation and validation are the form's own
(controlled `item`, Next validates the step's questions with the engine and
focuses the first invalid control) because questions keep the table's
controls (dropdowns with tags, the calendar, number formats), which the
Questionnaire does not validate natively. Enter in a single-line input goes to
Next; a failed submission jumps to the first step with an error; the review
lists answers as displayed (`formAnswerText`) with "Change" buttons.
`YayawTableForm` gains controlled answers and step (React `value` /
`onValueChange`, `step` / `onStepChange`; Vue `v-model:value`,
`v-model:step`) and `draftStorageKey` (answers and step in localStorage until
sent, via `readFormProgress` / `writeFormProgress`). The Form view keys the
form by view id so answers never leak between views.

Rule editor (form builder, both editions): a question's properties end with
"Conditions": the rules' summaries ("Shown when Category is Hardware and
Budget > 1000"), each rule's card (`FormRulesList`, in place: the properties
column and the phone tab have room for it), "Always shown." without rules and
"Add a condition"; the outline marks conditional questions. Changes join the
builder's draft. A rule has its action ("Show / Hide /
Require this question when…"), an All/Any segmented control (two radios under
a "Match" legend) when it has several items, condition cards, "Add
condition", "Add group" (one level) and removal buttons. A condition card
stacks question, then comparison and value, by container queries on the card:
comparison and value side by side from 18rem, all three in a row from 34rem
(lists and ranges take the card's width below that), remove button at the
top right. Comparisons use short complete labels (`cmp*` keys, e.g. "is",
"is not", "contains", "is empty", "before", "after", "between", "in the
last"; FR "est", "avant le"…; `formOperatorLabel` returns them). Values use
the table's controls: the option dropdown with tags for tag columns,
checkboxes for lists, the calendar popover for dates (and From/To ranges), a
decimal input for numbers, a days input with its "days" unit. A nested group
is an indented card with its own All/Any control and removal. Each card shows
its first problem (`issue*` labels) with its id in `aria-describedby` of the
card's controls and `aria-invalid` on the control concerned. `set` rules are
engine- and JSON-only.

Record create/edit forms (`FormConfig.rules`, conditions on field names,
effects in `fieldIds`): the runtime puts a `formRules` set on the form context
(`formRuleSet(config)` with the fields as `ConditionField`s); `fieldIsHidden`
and the new `fieldIsRequired` read the evaluation, `validateForm` applies `set`
values before validating, `formSubmissionValues` drops hidden fields, inline
edits refuse rule-hidden fields. Backward compatibility: a field's `hidden`
flag or predicate is converted at load into a rule with a code-only `custom`
condition (`predicateRule`) that receives the full context and the answers as
given, so existing predicates behave as before; `custom` conditions are never
serialised. Contexts without `formRules` (cell renderers, host code) keep
using the predicate directly. Collection items drop the parent's rules. The
create-form conditions are configured in code (there is no create-form
settings UI); the form builder is the only rule editor. React's form also
re-validates shown errors when values change so a rule change never leaves a
stale error blocking Save; Vue's catalogue form is `novalidate` so the rules,
not the browser's constraint bubbles, decide.

Bulk edit: the declared rules (not the legacy predicates, which keep running
per row) read the draft or the value every selected row shares
(`bulkConditionState`); a field whose value differs and is not in the draft is
"mixed" and conditions on it never match. Fields hidden only because of mixed
values are listed disabled in "Add a field" with "Depends on Category, whose
values differ across the selection. Set Category first."; added fields whose
rules read mixed values show "Values of Category differ across the selection:
the condition is treated as not met." (`bulkConditionMessages`, EN/FR).

Public links (security): `formLinks.publish(viewId)` — hosts build the
snapshot on their server from the saved view and their own columns with
`buildPublicFormSnapshot({ view, columns, allowedColumnIds?, defaults? })`:
only existing, creatable (form editor, not computed) and allowed columns are
kept, fixed values must fit their column (`validHiddenValue`: known option,
number, date, URL, boolean), rules and layout are included. The Share popover
still passes the browser-built snapshot as a deprecated second argument for
older hosts; hosts must ignore it. The demo host resolves the saved view
(built-in or saved by either example table) and ignores the argument.

Vue record forms (`DynamicField.vue`) now use the Form view's controls like
React: the table's dropdown (`FieldSelect.vue`, typed values, "Choose…"
placeholder, also in "select with add new"), a popover calendar in the table's
language (`FormDateField`, which gains `min`/`max`; React record forms also
move from the native date input to it), Reka switches and checkboxes,
checkbox lists for multi-selects and a Reka radio group. The Vue form dialog
keeps itself open while a portalled picker is used.

Demos: the "Request" form has rules (Hardware shows "Serial number" and
requires "Budget"; Other shows "Tell us more"); a second "Guided request"
view uses the steps layout with a review; the record presentation form
requires "Description" for Hardware (and shows the mixed note in bulk edit).
The views columns gain `serialNumber` and `notes` (hidden in the table by
default) and the category option "Other".

Verification: `tests/form-conditions-suite.ts` (operators per type, AND/OR,
nesting, chains, `set`, mixed, groups, cycles, validation, sanitation,
summaries, legacy predicates), `tests/form-view-rules-suite.ts` (settings,
sections, steps, submission stripping, public snapshot and server acceptance,
server-built snapshots against tampering, editor helpers) and
`tests/form-rules-runtime-suite.ts` (record and bulk forms) run in both
editions; `tests/form-links-demo.test.ts` checks the demo host ignores a
tampered snapshot. `e2e/form-conditions.spec.ts` covers, on both demos, the
page layout showing/hiding/requiring by rule, the steps layout (progress,
Enter, Back/Next/Skip, a conditional step appearing and disappearing, review,
submit), the rule editor (conditions in the builder's properties, the problem
linked to its control, a condition, a nested Any group, short comparisons,
the summary, saving and the form following it), the create form's
condition and date picked in the calendar, and the bulk edit mixed note.

## Form languages, consent and hidden fields

Forms placed on bilingual pages (a CMS, a site with several languages) get
localized texts, a GDPR consent question and hidden context fields. The model
is shared (`utils/form-text.ts`, new, and `utils/form-view.ts`, both synced to
Vue) and additive: saved settings with plain strings are valid as they are and
nothing is migrated.

Localized texts (`FormText`): every text of a form is a plain string, as
before, or one string per language, `{ en: "Name", fr: "Nom" }`: the title,
description, submit label, success message, the new `closedMessage` (shown
instead of the built-in "no longer accepting responses"), question label,
help and placeholder, section title and description, consent statement and
link, and the new per-question `optionLabels` (option labels by option value,
e.g. to translate a column's options). `YayawTableForm`'s `locale` prop (the
Form view passes the table's locale) picks the version: the exact locale, then
its language ("fr" for "fr-CA", or "fr-FR"), then the form's `defaultLocale`
(else the first of its `locales`); a plain string reads the same in every
language. A text with a default of its own then falls back to it, never to
another language's translation: a question label to the column name, an
option label to the column's, the submit label, success and closed messages
and the consent statement and link text to the built-in labels (with the
host's `form.<key>` overrides). Other texts (title, description, help,
placeholder, sections, the consent's address) show the first version
available. `resolveFormSettings(columns, defaults, view, locale, translate)`
resolves every text (`formTextVersion`, `resolveFormText`,
`formLocaleMatch`), so the renderers, steps, review, rule summaries and
validation keep working on strings. Language tags are
normalized (`fr_ca` → `fr-CA`, malformed tags dropped), empty versions
removed, and a text written only in the default language stays a plain string
(`setFormText`). Built-in labels still come in English or French (`fr*`) and
stay overridable with `form.<key>`. Snapshots keep every language, so one
published form serves every page language.

`table.form.locales` lists the host's languages (every form of the table has
them) and `table.form.defaultLocale` the language of plain texts; a view may
extend them (`locales` of the view, written by "Add language"). A form's
languages (`formViewLocales`, the same computation in both editions because
Vue seeds a view's settings from `table.form`) are its default language, its
`locales` and every language its texts use.

Form builder (both editions): an "Editing" switcher in the top bar (above the
preview and the properties on phones; one radio per language, named in itself:
"English", "Français"; arrow keys switch) and "Add language" (the host's
languages, then common ones, less those the form has); the preview follows the
language edited. Every text input edits the selected language: it shows that
language's text (`lang` set on the input), the default language's text as
placeholder, and a "Missing translation" badge (also its accessible
description) while another language has a text and this one has none; the
default language is flagged only when other languages have a text it lacks.
Question labels count the column name as a text to translate, option labels
the column's option labels; a consent's link address is never flagged (one
address often serves every language). Outline entries missing a translation
show a dot read as "Missing translation" (`formItemMissingTranslation`).
Above the properties, "Texts not translated show in English." names the
default language in the table's language, and the form's settings have a
"Default language" select (when the form has several languages) saying which
language plain texts are written in; changing it reinterprets them. Writing in another language pins
`defaultLocale` in the view when neither the view nor the table sets one
(the guess is the table's language), so plain texts keep their language
whoever edits them; hosts that know it set `table.form.defaultLocale`. The Form view shows a
"Language" switcher above the form (next to "Share form") when the form has
several languages, to preview it in each; answers are kept while switching.

The builder's properties are made of editors that stand on their own
(internal modules, not public API): React `form/form-languages.tsx`
(`FormLanguageSwitch`) and `form/form-editors.tsx` (`FormLocalizedText`,
`FormQuestionEditor`, `FormRulesList`, `FormConsentEditor`,
`FormHiddenFieldEditor`, and the small `FormSettingText`,
`FormSettingSwitch`, `FormSettingSelect`, `FormMissingTranslation`); Vue has
the same components (`FormLanguageSwitch.vue`, `FormLocalizedText.vue`,
`FormQuestionEditor.vue`, `FormRulesList.vue`, `FormConsentEditor.vue`,
`FormHiddenFieldEditor.vue`, `FormSettingText.vue`, `FormSettingSwitch.vue`,
`FormSettingSelect.vue`). Each takes its item, the language being edited
(`FormEditingLanguage`: `{ locale, defaultLocale, missingLabel }`), an id
prefix and the label function, and reports patches. The conditions dialog of
the former side panel (`FormQuestionRulesEditor`, `FormRulesDialog`) is gone.

Consent (`{ id, kind: "consent", text?, link?: { label?, href? }, version? }`,
added with "Add consent", bound to no column): a checkbox labelled by its
statement, always required ("Check this box to continue.", `errorConsent`),
`aria-required`, focused first when it is the first error. `{link}` in the
statement marks where the link goes (else the link follows in parentheses);
unset texts read the built-in "I agree to the processing of my answers." (with
a link: "… as described in the {link}.", "privacy policy"), in English or
French. Link addresses must be `https://`, `http://` or a site path (others
are dropped when saved); the link opens in a new tab, announced by
"(opens in a new tab)" read after its text. Rules cannot hide a consent: its
id is no rule target (rules aiming at it are dropped as `unknownTarget`), a
hidden section keeps its consents, and the builder offers no conditions for
it. The answer is kept in the draft under the consent's id (a consent sharing
an asked column's id is renamed `<id>-consent` when saved, never dropped),
errors are keyed by it, and it is never written to a column. In the steps layout a consent shows on the step it is
placed in (its section, or the question before it); one placed after the last
visible question, or whose step is skipped, shows on the last step, the review
when there is one (`formStepPlan`: `steps[].consents` and
`reviewConsents`); when the rules hide every question, the consents keep a
step of their own (`consents`); a step with a consent cannot be skipped and
Next validates it.

Hidden fields (`{ id, kind: "hidden", source, columnId? }`, "Hidden fields" in
the builder with "Add" → "Add hidden field", Source, Parameter name or Text, and
"Save in": "Response details" or a column): `source` is `{ type: "urlParam",
name }` (`utm_source`, `gclid`…), `pageUrl`, `referrer`, `locale` (the form's
language) or `{ type: "static", value }`. They are never shown; the browser
reads them when the response is sent (`collectFormHiddenFields`,
`formPageContext`). Bound to a column (text, long text, URL, number, date,
option or yes/no columns not asked; asking the column unbinds it), the value is
written like an answer and checked by the column's type (a number, a known
option, `YYYY-MM-DD`, an http(s) URL, `true`/`false`); a value that does not
fit is dropped, never an error people could not fix. Unbound, it goes to
`metadata.context` under the field's id. A record is built from the fixed
values, then the bound hidden fields, then the answers.

Submission and server: `onSubmit(values, meta)` receives `FormSubmitMeta`:
`context` (unchanged), `consents` (`{ id: true }`), `fields` (hidden values
read from the page), `locale`, and `metadata` as the browser sees it
(`onSuccess` also receives it). A public form's host sends `consents`,
`fields` and `locale` to its server with the values, where
`acceptPublicFormResponse(snapshot, values, { consents, fields, locale,
acceptedAt, translate })` treats them as untrusted: every consent must be
`true` (`errorConsent` otherwise), hidden fields read only the snapshot's
fields and sources, as text without control characters, cut at 500
characters; page and referrer addresses must be http(s), are dropped beyond
2048 characters and are kept without their query and fragment, which may
hold tokens (campaign parameters are read with `urlParam` fields); locale
tags are checked, fixed texts taken from the snapshot, unknown ids ignored.
It returns `{ ok: true, values, metadata }` with `metadata.consents: [{ id,
version, text, href?, locale?, acceptedAt? }]` (the statement as shown, the
link's text in place, and the language it is written in: the translation
used, or English/French for built-in statements; `translate` gives the
server the page's label overrides so built-in statements are recorded as
shown) and `metadata.context`.
`withFormServerContext(accepted, { pageId, revision, formToken })` adds what
the server knows under `metadata.server` (word-character keys; text, numbers
or yes/no values). Snapshots split hidden fields: the browser part
(`form.questions`) keeps the sources it reads, without columns or fixed texts;
`hiddenFields` and `hiddenColumns` stay on the server. `buildPublicFormSnapshot`
drops bindings to columns that are not allowed or creatable.

Contract notes: `FormItem` now also covers consents and hidden fields (use
`isFormQuestion` rather than "not a section" to narrow it), `ResolvedFormItem`
gains `{ kind: "consent" }`, `FormStep` gains `consents`, `initialFormDraft`
takes the consents, `formSubmission` the hidden values, `removeFormItem`
removes any item (`removeFormSection` is an alias), and
`acceptPublicFormResponse` also returns `metadata`.

Demos: the views table declares `form: { locales: ["en", "fr"] }`; the
Request form (and the Guided request, whose consent shows on the review step)
is in English and French except "Wanted by", left to translate, with a
consent to the privacy policy (version 2026-09) and hidden fields
`utm_source`, `utm_campaign`, `page` and `language`. The public page takes
`&lang=fr`; after a response it shows "Response received by the host" with
the record and its metadata; the demo host requires the consent, stamps
`acceptedAt` and adds `pageId` and the publication `revision`.

Verification: `tests/form-i18n-suite.ts` runs in both editions (resolution and
fallback, texts with a default of their own, plain strings unchanged,
settings writes and missing translations, languages and "Add language",
snapshots with every language, consent required/blocked/metadata and its
language, host overrides of built-in statements, rules and sections never
hiding it, renamed ids, step placement and the consent step, hidden field
collection, addresses without query or fragment, server sanitation and
column binding, server context); `tests/form-links-demo.test.ts` covers the demo host.
`e2e/form-i18n.spec.ts` covers, on both demos, switching the form builder to
French and translating a question (badge, placeholder, `lang`, the Form
view's French preview), the public form in French (texts, option and built-in
labels, consent error), an unchecked consent blocking the response and the
UTM parameters reaching the host's metadata, and adding a consent and a
hidden field in the builder; the existing form specs check the consent.

## Form builder

A view's form is edited in a near full-screen dialog in both editions (React
`form/form-builder-dialog.tsx` with `form-builder-outline.tsx`,
`form-builder-preview.tsx` and `form-builder-properties.tsx`; Vue
`form/FormBuilderDialog.vue` with `FormBuilderSession.vue`,
`FormBuilderOutline.vue`, `FormBuilderPreview.vue`,
`FormBuilderProperties.vue` and `FormBuilderFormSettings.vue`), built on a
framework-neutral controller shared by both, `utils/form-builder.ts` (synced
to Vue as `form-builder.ts`, like the file tree's controller):
`FormBuilderController` holds a draft of the view's form settings, the entry
selected, the language edited, the drag, the phone tab and the discard
question; views subscribe to `getState()` (React `useSyncExternalStore`, Vue a
shallow ref) and call its edits.

Opening: "Edit form" above the Form view (next to the language preview and
"Share form"), and View → Form settings, which now show a summary
(`formBuilderSummary` / `formBuilderSummaryLines`: "6 questions · 1 consent ·
4 hidden fields", "One page" or "Step by step, with a review", the languages),
"Edit form" and Reset. Settings' "Edit form" closes the menu (React
`useStackMenu().onOpenChange`, Vue the `settingsMenuCloseKey` the toolbar menu
provides) and asks the Form view to open its builder (React a jotai atom per
table, per instance store; Vue a request counter per table context), so one
builder opens with the view's public links. A view setting, `editButton:
false` ("Show “Edit form” above the form" in the builder), hides the button
above the form; the builder stays in View settings.

Layout, desktop and tablets from 1024px: a top bar (title "Edit form" and the
form's title, the layout as a segmented control, the Editing language switch
with "Add language", "Unsaved changes", "Form settings", "Share form" when the
host has `actions.formLinks`, Save and Close), then three labelled regions:
the outline (left), the preview (middle) and the properties (right).

- Outline: "Form settings" (the form's own settings: title, description,
  layout and review, default language, submit label, success message,
  "Offer another response", redirect URL, closed message, the Edit form
  button, Reset), then groups: the questions, sections and consents in order,
  the hidden fields, and the columns the form does not ask ("Not in the form":
  asking one, or a fixed value saved with every response), with a note on the
  columns forms cannot ask. Entries show the input's icon, the name in the
  language edited, a required mark, a conditions mark and a missing
  translation dot (each read by screen readers). "Add" lists the columns to
  ask, then "Add section", "Add consent" and "Add hidden field"; new items go
  after the selection and get selected. Reordering: drag an entry's grip
  (mouse, pen or touch; `attachFormOutlineDrag` shows where it drops and
  scrolls near the edges, Escape cancels) or Alt + ↑ / ↓ on the focused
  entry (`formBuilderKeyMove`; the entry keeps the focus and a live region
  says "Budget: position 2 of 7."); the properties also have Move up / Move
  down. The groups are a list, so a form writing several tables can add a
  group of its tables.
- Preview: `YayawTableForm` with the draft, in the language edited and the
  chosen layout, its rules applied as answers are typed; nothing is sent
  ("Answers typed here are not sent.", a success screen previews the success
  message) and "Show as closed" previews the closed message. The selected
  question, section or consent is outlined and scrolled into view (sections
  now carry their id on `data-form-section`).
- Properties: the selected entry's editors (see "Form languages, consent and
  hidden fields"), a question's conditions in place, Move up, Move down and
  "Remove from the form" (the column then shows under "Not in the form"), or
  Remove for sections, consents and hidden fields.

Saving: edits change the draft only; "Save" (or Ctrl/Cmd + S) writes it to the
view (`updateSettings`, so the view shows its unsaved-changes dot like any
view setting) and keeps the builder open; the top bar says "Unsaved changes"
until then. Close and Escape never lose work silently (a click outside does
not close the builder): with unsaved changes "Discard your changes?" offers
"Keep editing", "Discard" and "Save and close" (Escape closes an open menu or
select first). "Share form" publishes the saved form, never the draft: with unsaved
changes its panel says "Save your changes to publish them." (FormShare gains
`compact`, `iconOnly` and `note`; in the builder it is always a popover). The
dialog traps the focus, opens on the selected entry and gives the focus back to
"Edit form" when it closes.

Phones and narrow windows (below 1024px): the dialog fills the screen, the top
bar keeps the title, Share (icon), Save and Close, and Questions, Preview and
Properties are tabs; choosing an entry opens its properties, and the language
switch sits above the preview and the properties.

Columns a form may ask (`formColumns`, used by the builder, the preview, the
Form view, `resolveFormSettings` and `buildPublicFormSnapshot` alike): a form
editor (text, number, date, option, yes/no, URL, location…), and writable
(`formColumnWritable`): never columns a host flags `form: false`, `readonly`,
`readOnly`, `editable: false`, `computed`, `system` or `hidden`, nor
computed (`accessorFn`) columns, nor the metadata ids tables commonly carry
(`id`, `_id`, `uuid`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`,
`deletedAt` and their snake_case forms); `form: true` opts a column in. When
the host declares the table's create form (`getFormConfig` for
`form.createFormType`, else the table's form type, in create mode), the
contexts carry its fields (`formFields`, from `formCreateFields`: fields it
hides or disables are left out) and `withFormFields` marks the other columns
`form: false`: a Form view creates records like the create form. A form
without saved questions asks every column it may; saved questions on other
columns are not asked. The demo's "Posted at" is `readonly`.

Labels (English and French, `form.<key>`): `editForm`, `builderDescription`,
`builderOutline`, `builderPreview`, `builderProperties`,
`builderPreviewNote`, `builderShowClosed`, `save`, `unsavedChanges`,
`builderSaved`, `discardTitle`, `discardDescription`, `discard`,
`keepEditing`, `saveAndClose`, `addItem`, `addQuestion`, `noColumnsLeft`,
`notInForm`, `notInFormHint`, `askQuestion`, `removeQuestion`, `remove`,
`fixedValue`, `reorderHint`, `builderMoved`, `builderAdded`,
`builderRemoved`, `columnOf`, `untitledForm`, `questionKind`,
`hasConditions`, `languages`, `inTheView`, `editButtonSetting`,
`editButtonHint`, `resetHint`, `saveToPublish` and the `summary*` counts.

Verification: `tests/form-builder-suite.ts` runs in both editions (the
outline, languages and pinning, asking and removing, sections, consents and
hidden fields after the selection, rules, fixed values, reset, Alt + arrows,
drag and drop with hidden fields kept in place, saving and the discard
question, phone tabs, settings compared regardless of key order, the summary
in English and French, columns forms never ask, the create form's fields);
`e2e/form-builder.spec.ts` covers, on both demos, editing a question with the
preview following, Alt + ↑ and its announcement, asking a column with a
condition applied in the preview, French and the missing translation dot, the
steps layout, saving, closing and reopening; the summary in View settings
opening the builder, Escape asking before discarding (Keep editing, Discard);
a form without questions never asking the read-only column (outline, Add menu,
note); dragging an entry's grip; and the phone tabs.

## Table instances on one page

Both editions take two additive props for pages with several tables:

- `instanceId` scopes an instance's URL keys: `<instanceId>-view`,
  `<instanceId>-historyIndex` (React) and `<instanceId>-<key>` instead of
  `view`, `historyIndex` and `<tableId>-<key>`. React also gives the instance
  a jotai store of its own (`TableInstanceScope`), so two instances of one
  table never share atoms; Vue instances already keep their state in their own
  refs. Config, actions and saved views still resolve by table. Without
  `instanceId`, keys and stores are unchanged.
- `initialView: { id?, config }` starts an instance whose URL sync is off
  from a saved view before its first request: React seeds the instance's
  store with what selecting the view writes (`seedTableViewState`), Vue
  applies it with `applyView` before loading. With URL sync on it is ignored
  in both; use `initialActiveViewId`.

React embedded instances share the host's single `QueryClient` (required), so
their `tableId` doubles as the cache key; Vue instances create their own
client. Dashboards pass an instance id that changes with the widget's
dashboard filters and with "Refresh all", so a widget reloads with fresh data.

Verification: `tests/table-instances.test.tsx` and
`packages/yayaw-table-vue/src/components/table-instances.test.ts` check that
two instances of one table write only their own keys (the shared `view` key
included), read only their own keys from an incoming URL, and that two
embedded instances each send their own view's filters in their first request
without touching the URL.

## Dashboard

Dashboards ship as optional registry items: `yayaw-table-dashboard` (React:
`YayawDashboard`, shadcn `alert-dialog`, `button`, `calendar`, `command`,
`dialog`, `dropdown-menu`, `input`, `native-select`, `popover`, `textarea`)
and `yayaw-table-vue-dashboard` (Vue: `YayawDashboard.vue`, reka-ui like the
table). Both list `gridstack` and load it, with its stylesheet, in a chunk
fetched by the first desktop grid (`import("./dashboard-grid-engine")`), never
by the table or on phones. The screen editor is another chunk, fetched when
edit mode starts (see [the screen editor](#dashboard-screens-the-screen-editor)).

Grid engine: gridstack.js in both editions rather than react-grid-layout and
grid-layout-plus, so dragging, resizing, collisions and top gravity are the
same code. The framework renders the items (`.grid-stack-item[gs-id]`);
`dashboard-grid-engine.ts` (shared, synced to Vue) hands them to gridstack,
applies layout changes and reports every widget's place after a drag or a
resize. Until gridstack is ready (or if it fails), `dashboard-grid.css`
(shared) places the items from CSS variables, so there is no layout shift.
Grids narrower than 640px stack the widgets in reading order, full width,
without drag, each as tall as on desktop (its rows of 120px less the
margins); the widget menu still moves them.

The shared `dashboard-schema.ts` (the JSON grammar), `dashboard-layout.ts`
(grid layouts) and `dashboard-model.ts` (loading, filters, numbers, labels)
own the contract and every rule:

- JSON version 2: `{ version: 2, id, name, description?, sections: [{ id,
  type: "grid", title?, layout: [{ widgetId, x, y, w, h }] } | { id, type:
  "flow", title?, widgetIds }], widgets: [{ id, type: "view" | "kpi" |
  "note" | "table" | "block", title?, tableId?, viewId?, view?, block?,
  props?, settings }], filters, updatedAt? }`, described in
  [Dashboard screens](DASHBOARD-SCREENS.md). `validateDashboard` reads
  versions 0 and 1 (their layout becomes one grid section `main`; version 0
  layout items keyed `i` become `widgetId`), repairs what it can and reports
  issues with a severity and a JSON path; `normalizeDashboard` throws for
  non-dashboards and newer versions.
- Layout: 4 columns, rows of 120px, widgets 1–4 wide and 1–12 tall; overlaps
  are resolved with the moved widget fixed, then everything rises (gridstack's
  top gravity). Keyboard moves swap with the neighbour above, below or beside
  (left/right fall back to one column); Wider moves the widget left at the
  edge. Menu entries that cannot apply are disabled. New widgets take the
  first free spot at a size that suits them (`defaultWidgetSize`,
  `dashboardWidgetSize`): numbers 1×1, notes 1×2, views 2×2 (table, list,
  chart, map), boards, galleries, calendars, feeds and forms 2×3, file trees
  1×3, Gantt charts 4×3 — by the display mode of the chosen view, or of the
  table's default view.
- Widgets: `view` renders the saved view (`viewId`, or the table's defaults)
  in its display mode through an embedded table (`instanceId`,
  `initialView`; URL sync, toolbar, header, saved views and row selection
  off). `kpi` renders a number (`metric`: count, sum, avg, min, max;
  `metricColumn`) over its view's records, loaded by the dashboard itself
  through the chart contract (`loadDashboardKpi`: `aggregate` with
  `groupBy: []`, else the rows `list` returns), so numbers no longer need the
  chart renderer. `note` renders `settings.text` through the host's
  `renderMarkdown` (React node / Vue `VNodeChild`) or as plain text.
- No inner scrollbars by default. Widget bodies clip (`overflow: hidden`) and
  are CSS size containers. A view widget's `settings.overflow` is `"fit"`
  (default) or `"scroll"`:
  - Fit, in table, list, gallery, board and feed modes: the embedded table
    has no pagination and loads `dashboardFitPageSize(mode, size,
    view.pageSize)` records (the view's own page size when it has one, e.g. a
    "Top 5" view; otherwise enough to fill the widget with the smallest
    records, 5 to 100). `dashboard-fit.ts` (shared DOM helper) then hides, on
    every resize and content change (ResizeObserver, MutationObserver, image
    loads, fonts), the board lanes and table columns that overflow the width
    and the records that overflow the height, from the lowest up; the first
    record always stays. Records are the elements marked `data-row-id` (table
    rows, list lines, gallery cards, board cards, feed posts — both editions),
    lanes `data-kanban-lane`, boards `data-kanban-board`; hidden ones carry
    `data-dashboard-overflow`. The widget's footer reads "+N more · View all"
    (`moreCount`, `viewAll`): N is the `list` total (`meta.totalCount`, else
    the rows sent) less the records shown, and View all calls `openView`.
    Board lanes share the width (`minmax(9rem, 1fr)`), feeds lose their "Load
    more" footer.
  - Scroll: the body scrolls, and table, list, gallery, board and feed views
    keep their pagination (every other mode has none in a widget).
- Charts fill their widget: the embedded table's chart defaults get
  `fill: true` (a new chart setting, also usable by hosts): the chart takes
  its size container's height (`100cqh`), drops its title, table toggle and
  hint, and `chartFillLayout` (shared chart model) decides from its measured
  size where the legend goes (beside a donut in a wide box, under the chart
  when the plot keeps 96px, beside it when that fits, else none), whether
  data labels fit (36px per category, 18px per horizontal bar, 150px of
  height; donut values when the legend shows), whether the value axis stays
  (220px wide, and never with values on bars) and which category labels show
  (Recharts `preserveStartEnd`; every `categoryStep`-th tick with
  `tickTextHideOverlapping` in Unovis). Small donuts keep only their total.
- Numbers: `settings.dateColumn` enables `compare: { period: "previous",
  days?: 30, better?: "up" | "down" }` (or `true`) and `sparkline: { bucket?:
  "month", buckets?: 6 }` (or `true`), normalized by `dashboardKpiSettings`.
  `dashboardKpiPlan` builds the requests: the current period is the
  dashboard's date range on `dateColumn` when a date filter targets it (both
  ends; a start alone runs to today, an end alone `days` back), otherwise the
  last `days` days up to today; the previous period is as long, just before
  it. Each request replaces the dashboard's rules on `dateColumn` by its
  period (`between`), keeps the others and goes out as `requiredFilters`. The
  trend groups the metric by `bucket` over the `buckets` buckets ending with
  the current period (`dashboardSparklineKeys`, missing buckets are 0).
  `dashboardKpiDisplay` formats the figure with the column's format
  (`chartValueFormatter`), the change as "+12% vs previous period" in the
  locale's percent format (`dashboardComparisonText`; one decimal under
  10 %, "Nothing in the previous period" when only the current period has a
  value) with a tone (`better` decides whether up is good) and a tooltip
  naming both periods, and the trend as an SVG polyline
  (`dashboardSparklinePoints`) titled with each bucket's value. Number cards
  are compact (title above the figure, no header rule) so the figures of a
  row line up.
- Compact filters: outside edit mode each filter is one button showing its
  name, then its value ("Due date" "Any date", "Category" "All"); its legend
  and "Applies to …" stay for screen readers (`aria-describedby`). Edit mode
  shows them as before, with the remove buttons and "Add filter".
- The widget dialog's settings: views choose "Records that do not fit" (fit or scroll);
  numbers choose a date column, "Compare with the previous period" with its
  period (7, 30, 90 or 365 days) and "Better when it" goes up or down, and
  "Trend line" (6 months). The draft is shared (`emptyWidgetDraft`,
  `dashboardWidgetFromDraft`, `dashboardDateColumns`,
  `dashboardCompareDayOptions`).
- Filters: `dateRange` (`{ start?, end? }` calendar days → `between`,
  `greaterThanOrEqual` or `lessThanOrEqual`) and `select` (values →
  `isAnyOf`), each with `targets: [{ tableId, columnId, widgetIds? }]`.
  `withDashboardFilters` wraps a table's `list` and `aggregate`:
  `mergeDashboardFilters` appends the rules to the view's active rules (AND)
  and also sends them as `requiredFilters`, which hosts must AND. A view that
  matches any of its rules (OR, two or more) keeps its `advancedFilters` and
  relies on `requiredFilters`, as a flat list cannot say "(A or B) and C".
  The demo hosts honour `requiredFilters`. Filter values picked in view mode
  stay in the URL (`<dashboardId>.<filterId>`), never in the document; edit
  mode adds and removes definitions and sets their default values.
- Labels: EN/FR `dashboardLabel`, host overrides `dashboard.<key>`
  (`translations`). `locale` reaches every widget (numbers, dates, table
  labels) and `tableTranslations` (the page's `DataTableTranslations`) is
  passed to every embedded table: React has no built-in French table labels,
  so a French page passes its own; Vue picks its built-in French from
  `locale` and applies `tableTranslations` as overrides.
- Phones: widgets stack in reading order. Numbers and notes take the height
  of their content and charts a 16:10 body (11–20rem) from the phone's width
  (`dashboard-grid.css`, via `data-widget-type` and `data-widget-mode`);
  record widgets keep their rows' height, which sets how many records fit.

Behaviour, identical in both editions: the header shows the name (an input in
edit mode), "Refresh all", "Add widget" and "Add section" (edit), "Edit"/"Done" when `canEdit`;
"Done" saves through `actions.dashboards.save` and toasts. Each widget card
has its title, "Open full view" (`openView(tableId, viewId | null)`, table
and number widgets) and, in edit mode, a drag handle and the menu (Move
left/right/up/down, Wider/Narrower, Taller/Shorter, Remove), with moves
announced in a polite live region. A widget shows "Loading…" while its views
load, an error when its table or view is missing or its `list` fails (with
Retry), and an error boundary (`WidgetErrorBoundary` / `onErrorCaptured`)
keeps a failing widget from breaking the others.

Filter controls are the library's own: a date range filter opens the Form
view's popover calendar in range mode (react-day-picker in React, reka-ui
`RangeCalendar` with the form calendar's styles in Vue), its button reading
"Any date", "From Sep 1, 2026", "Until …" or "Sep 1, 2026 – Sep 10, 2026"
(`dashboardDateRangeText`, the days in the first target column's date format); a select filter opens an option dropdown with
"All" and a checkbox per option, and shows the chosen options as the table's
tags (`tagAppearance`, the first target table's `coloredTags`).

Found on the way, now aligned in both editions:

- Vue number charts drew nothing; they now show the figure and what it
  counts, as React does.
- Booleans render as a checkbox-style mark everywhere a cell renders them
  (table, list, board and gallery cards): filled with a check for true, an
  empty box for false, `role="img"` named by `common.true`/`common.false`.
  React used a green or red (destructive) "True"/"False" badge, Vue a ✓ or
  "—" chip.
- Compact board cards (no property labels) leave out properties with
  nothing to show (`isBlankCardValue`: null, blank text, empty list; false
  and 0 are values). Vue board cards now default to the visible columns, as
  React does, instead of every column (hidden ones showed "—").
- Card pagination (list, gallery, board) shows when there is more than one
  page by the server's page count or by the row count, as React decides;
  Vue used the server's page count only.

Verification for these: `tests/boolean-cell.test.tsx`,
`packages/yayaw-table-vue/src/components/card-value-parity.test.ts`, the
shared `value-format` suite, the picker test (booleans, board cards) and the
last test (list pages) of `e2e/dashboard.spec.ts`.

Demo: "Projects overview" (`?example=dashboard`, `examples/dashboard.ts`,
identical in both editions), laid out to fit 1280×800 without a scrollbar
and to stack on phones. Its own data follows today (32 projects due from
six months ago to next month, 10 tasks), so the numbers, comparison and
trends always look current. Row 1: four numbers — Revenue (sum of Revenue,
last 30 days by Due vs the 30 before, 6-month trend), Projects (count,
6-month trend), Needs attention (count of the "Delayed or On hold" view) and
Due this week (count of the "next 7 days" view). Rows 2–3: "Revenue by
month" (line, 2×2), "Revenue by category" (horizontal bars with values,
1×2), "Projects by status" (donut, legend beside, 1×2). Rows 4–5: "Top
projects by revenue" (list sorted by revenue, 5 per page, 2×2) and "Open
tasks" (table, 2×2), both "+N more". Filters: "Due date" on Projects › Due
and Tasks › Deadline, "Category" on Projects › Category. In-memory storage
mirrored in `sessionStorage` (key `yayaw-demo-dashboards-v2`). `?readonly`
removes edit rights; `?theme=dark` shows the dark tokens; `?lang=fr` shows it
in French (React passes French pagination labels as `tableTranslations`). Requests are
logged in `window.yayawDashboardRequests`; "Open full view" and "View all"
show what the host received in a corner.

Verification: `tests/dashboard-model-suite.ts` (normalization, collisions,
keyboard moves and resizes, phones, grid changes, widgets, KPI configs,
titles and labels, views, filter rules per widget, AND merge and
`requiredFilters`, action wrapping, filters, validation and versions, default
sizes, fit page sizes and "+N more" counts, KPI settings, periods,
comparisons and their text, sparkline buckets, values and points, KPI plans,
loading through `aggregate` and through `list`, KPI display, picker drafts)
runs in both editions; `tests/chart-model-suite.ts` covers `chartFillLayout`
and the `fill` setting in both. `e2e/dashboard.spec.ts` on both demos: at
1280×800 every widget renders from its own view, with the numbers, the
revenue comparison ("+38% vs previous period", positive, up) and trend
lines, filled charts without titles, and no element inside the dashboard
scrolling either way (nor the page); fit widgets show whole records inside
their card, "+N more" matches the total less the records shown, View all
opens the full view, and widgets have no pagination nor selection; the due
date filter reaches `list`/`aggregate` as `requiredFilters` and becomes the
revenue's period (its comparison text checked against the demo data), the
category filter narrows the projects; keyboard moves and resizes are saved
and kept after a reload; a one-row donut drops its legend and narrow charts
still draw, without scrollbars; drag to move and the resize handle; the
picker adds a tasks table (2×2, booleans as marks), a board (2×3, cards
inside, "+N more") and a number comparing 90 days with its trend, and a note
has nothing to open; phones stack in reading order without drag or
scrollbars, numbers at their content's height, charts at 16:10 and record
widgets at their rows' height; a French page (`?lang=fr`) shows French
dashboard labels and a scrolling widget's pagination in French; "Open full
view" calls the host and readers cannot edit.

### Dashboard JSON version 2 (screens)

Version 2 turns a dashboard into a screen: sections in order (grids of cards
and full-width flows), widgets placed by id (views and numbers over saved or
inline views, notes, full-page tables, host blocks), and localized texts
(`string | { en, fr }`, the form texts' type and resolver). Both editions
share the grammar and its tools, synced to Vue by
`scripts/sync-table-contracts.mjs`:

- `dashboard-schema.ts`: types and constants, `validateDashboard` (versions
  0, 1 and 2 read, version 2 written; errors and warnings with JSON paths;
  `DASHBOARD_LIMITS`), `normalizeDashboard`, `checkDashboardReferences`,
  `dashboardJsonSchema`, `canonicalDashboardJson`, `dashboardFingerprint`
  (pure SHA-256), the KPI settings (`dashboardKpiSettings`, moved from the
  model) and the builders (`createDashboard`, `addDashboardSection`,
  `addDashboardWidget`, `removeDashboardWidget`, `moveWidgetToSection`,
  `moveDashboardWidget`, `resizeDashboardWidget`,
  `applyDashboardSectionLayout`).
- `dashboard-sources.ts`: source summaries, the lazy `DashboardSources`
  contract and `createDashboardSourceLoader` (cache, shared concurrent loads,
  unavailable kept, errors retried, `tables` first).
- `dashboard-layout.ts`: the grid layout helpers, per section;
  `dashboard-model.ts` still exports what moved.
- `utils/view-config.ts` (the table's): `sanitizeViewConfig`, strict and
  hostile-proof, for inline views and any saved-view settings a server
  receives; synced to `packages/yayaw-table-vue/src/view-config.ts` with
  `../planning/` read as `./planning/`.

These modules import no React, Vue or CSS
(`tests/server-safe-modules.test.ts`), so hosts validate documents and AI
tool inputs on their servers.

Rendering, identical in both editions (`YayawDashboard`,
`dashboard-section.tsx` / `DashboardSection.vue`):

- Sections render in order; empty ones are skipped. A grid section is its own
  gridstack grid with its own layout (stacked on phones); a flow section
  (`[data-dashboard-flow]`) stacks its widgets at full width and their natural
  height: record views keep their pagination instead of fitting, charts take
  a 16:10 body (11–24rem), bodies do not clip (`dashboard-grid.css`).
- A titled section shows an `h3` (`data-section-title`) and its widgets'
  titles as `h4`; untitled sections keep widget titles at `h3`.
- Inline views (`widget.view`) reach the embedded table as its `initialView`
  (id `null`) and the numbers' requests as their filters; "Open full view"
  calls `openView(tableId, null, { view })`.
- Names, section and widget titles and filter labels show in `locale`
  (`dashboardText`, `dashboardFilterLabel`); renaming in edit mode changes
  the text of the current language (`setDashboardText`).
- `table` and `block` widgets render full-page tables and host blocks (see
  [Dashboard screens: sources, blocks and full-page tables](#dashboard-screens-sources-blocks-and-full-page-tables)).
- Edit mode: grid cards drag, move and resize as before; flow widgets have no
  drag handle and their menu moves them up and down (no resizing). "Add
  widget" adds to the first section that takes the widget (see
  [the screen editor](#dashboard-screens-the-screen-editor)). "Done" saves
  version 2.

Verification: `tests/dashboard-schema-suite.ts` (migration round trips,
refusing version 3, unknown widget types, unknown keys at every level,
limits and `tooLarge`, id slugs and remapped references, orphan and
misplaced widgets, `conflictingView`, settings per type, block props and
`validateProps` success, problems and throws, severities and `ok`, hostile
documents, references, JSON Schema enums against the constants, sources and
blocks in the schema, fingerprints and SHA-256 against the platform's,
builders), `tests/view-config-suite.ts` (fixed point on the demo views and
every mode, unknown keys at every level, wrong types, caps, historical names,
OR rules, hostile JSON, JSON copies) and `tests/dashboard-sources-suite.ts`
(shared loads, caching, unavailable, error then retry, `tables` first) run in
both editions; `tests/server-safe-modules.test.ts` walks the modules'
imports in both; `tests/dashboard-sync.test.ts` checks the Vue copies;
`tests/dashboard-model-suite.ts` covers version 1 saved back as version 2,
inline views and localized titles. `e2e/dashboard.spec.ts` on both demos:
the version 1 demo saved back as version 2 (sessionStorage) and shown again,
a version 2 document with a titled grid and a flow (inline number filter,
paginated inline list, a full-page table, an unknown block, note, no
scrollbar, "Open full view" of an inline view), its texts in French, and flow
widgets moved in edit mode and saved with their sections and localized name.

### Dashboard screens: sources, blocks and full-page tables

`YayawDashboard` renders screens the same way in both editions (React
`yayaw-dashboard.tsx` with `dashboard-hooks.ts`, `dashboard-page-table.tsx`,
`dashboard-block.tsx`; Vue `YayawDashboard.vue` with
`dashboard-composables.ts`, `DashboardPageTable.vue`,
`DashboardWidgetContent.vue`). New props, identical in both: `sources` (a
lazy `DashboardSources<DashboardTableSource>`; `tables` stays and wins),
`blocks` (`Record<key, DashboardBlock>`), `dashboard` (a document to show;
`actions` is then optional, and "Edit" needs `actions.dashboards.save`),
`showTitle` (default true), `unavailableWidgets` (`"show"` | `"hide"`),
`syncUrl` (default true) and `openView(tableId, viewId, context?: { view })`.
The shared modules own every rule:

- `dashboard-sources.ts`: `dashboardSourceIds` (the sources the screen's
  `view`, `kpi` and `table` widgets read, in display order: the only ones
  loaded), `dashboardWidgetAvailability` (loading, ready, error, unavailable,
  unknown block) and `dashboardUnavailableWidgetIds`.
- `dashboard-model.ts`: `resolveWidgetView` (inline, saved or default view;
  loading until the source's views load; missing), `dashboardTableInstanceId`
  (the screen's first table keeps the table's URL keys, the others use their
  widget id), `dashboardScreenView`, `dashboardScreenViewId`,
  `isDashboardViewId`, `dashboardTableViews` and `withDashboardTableViews`
  (the inline view as a system default view `screen:<dashboardId>:<widgetId>`
  first of `initialViews`, a `viewId` marked default in `views.list`),
  `withMutationSignal` (create, update, delete, duplicate, bulk actions,
  `import.importRows`, the file tree's `move` and `createFolder` call back
  once settled), `dashboardVisibleSections` (hidden widgets out, grids
  compacted, empty sections dropped, for display only), relative date presets
  (`DASHBOARD_DATE_PRESETS`, `resolveDashboardDateRange`,
  `dashboardDatePresetOptions`), readers' filter values
  (`dashboardFilterUrlKey`, `encodeDashboardFilterValue`,
  `decodeDashboardFilterValue`, `readDashboardFilterValues`,
  `writeDashboardFilterValues`, `setDashboardViewerFilter`,
  `withDashboardFilterValues`, `dashboardFilterValues`), notices
  (`dashboardListNotice`, `withNoticeCapture`, `dashboardNoticeText`,
  `dashboardUnavailableText`) and `dashboardOpenViewContext`. New EN/FR
  labels: the unavailable reasons, "Unavailable block", "Screen default",
  "Full-page table", "Block", the six periods, a notice's fallback.
- `dashboard-schema.ts`: `DashboardBlockSchema` (`label`, `description`,
  `group`, `placement`, `defaultSize`, `defaultProps`, `validateProps`,
  `propsSchema`; `DashboardBlockDefinition` is its alias), date range values
  with a `preset` (validated, in the JSON Schema), `dashboardWidgetOrder`.
- `dashboard-url.ts` (DOM, shared): reads and writes the readers' filter
  values in the page URL with `history.replaceState`, leaving the table's
  keys (nuqs in React, the History API in Vue) as they are.

Behaviour, identical in both editions:

- Widgets of a loading source say "Loading…"; a failed load shows its error
  and Retry; an unavailable source a muted notice (the host's message, else
  the reason's text); a block key the host lacks "Unavailable block". These
  widgets stay in the document and in edit mode (removable), and "Done" saves
  them as they are. `unavailableWidgets: "hide"` leaves them out of the view
  and compacts the grids; a section left empty disappears.
- `table` widgets render the source's `DataTable` / `YayawDataTable` with
  its toolbar, saved views, selection and URL sync, without a card
  (`data-widget-frame="page"`, an edit bar in edit mode, a heading only for a
  title of its own). `tableProps` (host code, never stored) and
  `renderTable(props)` come from the `DashboardTableSource`. The config's
  `showToolbarHeader` is off (the screen names the table). Screen filters
  reach it as `requiredFilters`; new rules mount it again (React also resets
  its cached rows). Its inline view is the screen's default view, after the
  reader's favorite.
- Blocks receive `{ widgetId, props, size?, editing, locale, revision,
  filters, refresh(tableId?), openView? }`, `props` over the block's
  `defaultProps`. A throwing block is contained (`WidgetErrorBoundary` /
  `onErrorCaptured`). A block rendering nothing collapses in a flow section
  (`:empty`, not while editing) and stays an empty card in a grid. Vue renders
  block components raw (`toRaw`), so a registry kept in reactive state does
  not make them reactive.
- "Refresh all" reloads numbers, views and blocks (their revision), retries
  failed sources and reloads full-page tables: React invalidates the table's
  query (`invalidateTableDataQuery`; a remount would show rows cached for 5
  seconds), Vue calls `YayawDataTable`'s exposed `refresh()` (new
  `defineExpose({ refresh })`) or, for a host's `renderTable`, invalidates the
  query client it passes. Changes made in a full-page table reload the other
  widgets of its source and the blocks, once for a burst (150 ms).
- Filter values picked in view mode are view state in the URL
  (`<dashboardId>.<filterId>`, never in the document, no `change` event);
  edit mode shows and changes the document's defaults, entering it drops the
  URL values, and only "Done" saves. Date range filters list the six
  relative periods beside the calendar (`[data-filter-presets]`, pressed
  when chosen); widgets send their days (`YYYY-MM-DD`), resolved in the
  reader's time zone.
- `meta.notice` in a `list` or `aggregate` answer shows a muted notice
  (`[data-widget-state="notice"][data-widget-reason]`) instead of the
  number, the view's records or the full-page table, kept mounted behind it.
  Both editions type it (`TableNotice`: `{ code?, message? }` or a text) in
  `TableActions.list`'s answer and in `TableAggregateResponse`.
- Phones: blocks, like numbers and notes, take the height of their content.

Demo: "Content admin" (`?example=screen`, `examples/screen.ts`, identical in
both editions): ten sources loaded on demand (`audit` forbidden, `billing`
not configured, `analytics` answering `meta.notice`), an overview grid (two
numbers over inline views, the storage, an "Audit events" number shown as
unavailable, the `shortcuts` and `attention` blocks, a gallery of recent
uploads) and the Pages list page wrapped by the host's `renderTable`, with
period and author filters. `window.yayawScreenSourceLoads` logs the sources
loaded; `?readonly`, `?hide` and `?lang=fr` as for the dashboard demo.

Verification: `tests/dashboard-model-suite.ts` (`resolveWidgetView`, the
table instance-id rule, the screen's default view and marked views,
`withMutationSignal`, the visible compacted sections, `meta.notice` in
numbers, the new EN/FR labels, relative presets and their rules, texts,
comparisons and validation, readers' URL values) and
`tests/dashboard-sources-suite.ts` (the sources a screen loads, widget
availability, hidden widgets) run in both editions;
`tests/dashboard-schema-suite.ts` checks the presets in the JSON Schema and a
block's label in its description. `tests/dashboard-screen.test.tsx` and
`packages/yayaw-table-vue/src/dashboard-screen.test.ts` render a given
document without storage or title: `tables` before the catalogue, which loads
only the forbidden source, a number, an unavailable notice, a `meta.notice`,
block props over defaults with the screen's period, an unknown block, a
contained failing block, an empty block, and readers' URL values over the
default (and not without URL sync); the Vue test also calls the table's
exposed `refresh()`. `e2e/screen.spec.ts` on both demos: sections and
numbers from the demo's data, only three of ten sources loaded, unavailable
notices and `?hide` closing the gap (and keeping the layout on save), the
page table's screen view, list page links (`pages-sort`) kept over a reload,
saved views and the reader's favorite before the screen's view, the author
filter and the last 7 days in `requiredFilters` and in the URL (the document
untouched), blocks, an unknown block, an empty block collapsed in a flow, a
bulk deletion reloading the numbers, "Refresh all" asking `list` and
`aggregate` again, a hostile document repaired and an unknown block kept on
save, phones and French, and `meta.notice`. Known Vue difference, not
specific to screens: a Vue table opened with `<tableId>-page` in the URL
starts on the first page (React keeps it).

### Dashboard screens: the screen editor

The editor is the same in both editions and loads in a chunk of its own when
edit mode starts: React `dashboard-editor.tsx` (`React.lazy`) with
`dashboard-widget-dialog.tsx`, `dashboard-source-picker.tsx` (shadcn
`command`, cmdk), `dashboard-view-editor.tsx` and the filter dialog from
`dashboard-dialogs.tsx`; Vue `DashboardEditorLayer.vue`
(`defineAsyncComponent`) with `DashboardWidgetDialog.vue`,
`DashboardSourcePicker.vue` (reka-ui Listbox), `DashboardViewEditor.vue`,
`DashboardKpiFields.vue`, `DashboardBlockProps.vue` and
`DashboardAddFilter.vue`. The section bars (`dashboard-section-bar.tsx`,
`DashboardSectionBar.vue`, `DashboardEmptySection.vue`), the "Add section"
menu and the widget menu's new entries stay with the screen. The shared
`dashboard-editor-model.ts` (synced to Vue, server-safe) owns the rules;
`dashboard-model.ts` the dialog drafts (`dashboardWidgetFromDraft`,
`dashboardWidgetDraft`, `dashboardTextInput`, `editDashboardText`) and the
editor's EN/FR labels; `dashboard-schema.ts` adds `checkDashboardBlockProps`,
exports `dashboardAcceptedSections` and takes `blocks` in widget placements.
React's `AddWidgetDialog` and Vue's `DashboardAddWidget.vue` are gone.

Behaviour, identical in both editions (see
[Dashboard screens](DASHBOARD-SCREENS.md#the-screen-editor)):

- Sections: "Add section" (Grid of cards, Full width, up to 12); in edit mode
  a bar with the title input ("Section title", the current language's text)
  and a menu (Move up, Move down, "Add widget here", Remove, confirmed by an
  alert dialog `[data-dashboard-dialog="remove-section"]` when the section
  holds widgets); empty sections show in edit mode only
  (`[data-section-empty]`, "Add widget here").
- Widget menus in edit mode: "Edit…", "Edit view…" (view, number and
  full-page table widgets whose source is ready), "Use a copy of this view"
  (a saved view the screen knows), "Make the current view the screen
  default" (full-page tables), "Move to section" (a submenu of the sections
  that take the widget), then the moves, resizes and Remove as before. Long
  menus scroll inside the window.
- The widget dialog (`[data-widget-step]`: `what`, `source`, `settings`,
  "Step 1 of 3"): kinds (`[data-widget-kind]`: Number, View, Table page in
  flows, Note) then the blocks the section takes under their group; the
  catalogue (`loader.list()`, searched and grouped, unavailable sources
  `aria-disabled` with their reason, the first available one highlighted,
  Enter picks it; picking loads it once and a failure shows its reason); the
  settings (Start from the default, a saved or a custom view with "Edit
  view…", a view's overflow, a number's fields, the title, a note's text, a
  block's `settings` component with props over its `defaultProps` or JSON
  checked by `checkDashboardBlockProps`). Editing opens on the settings step
  and keeps the widget's id and place (`updateDashboardWidget`).
- The view editor (`[data-view-editor]`): a near full-screen dialog (full
  screen on phones) with the source's live table (`dashboardViewEditorConfig`,
  `dashboardViewEditorActions`: no URL sync, saved views, selection or
  writes; the host's `translations`, `getRowId` and `displayModeRenderers`
  from `tableProps`), "Unsaved changes" (`[data-view-editor-status]`),
  "Apply" (`[data-view-editor-apply]`, `dashboardViewToApply`) and a close
  button; closing with changes, or Escape, asks
  (`[data-view-editor-confirm]`: Keep editing, Discard, Apply and close);
  clicks outside are ignored.
- Full-page tables record their reports (`onViewConfigChange` /
  `view-config-change`, after a host's own handler in `tableProps`) for "Make
  the current view the screen default".
- "Done" runs `validateDashboard` with the host's blocks; errors keep edit
  mode and show in `[data-dashboard-issues]` (`role="alert"`, each item's
  `data-issue-code`, named by `dashboardIssueTarget`), else the repaired
  document is saved.

Demo: the `attention` block of `?example=screen` has an `items` prop
(`validateProps`, `propsSchema`) and a `settings` form (checkboxes); the
`shortcuts` block's props are JSON.

Verification: `tests/dashboard-editor-suite.ts` runs in both editions
(`tests/dashboard-editor.test.ts`,
`packages/yayaw-table-vue/src/dashboard-editor.test.ts`): section limits,
moves, removal with its widgets and filter targets, titles per language,
move targets and moves between sections, the dialog's kinds per section and
block placement, the catalogue's search, groups and reasons, view editor
sessions (start, changes, what "Apply" stores, the page size rule, hostile
reports), the read-only table config and actions, inline copies of saved
views, block props as JSON, drafts to widgets and back,
`updateDashboardWidget` and issue targets. `tests/dashboard-editor-chunk.test.ts`
walks both editions' static imports: readers never load the editor's modules
and the editor's chunk holds them. `tests/server-safe-modules.test.ts` walks
both `dashboard-editor-model.ts`; `tests/dashboard-sync.test.ts` checks the
Vue copy. `e2e/screen.spec.ts` on both demos: the editor's chunk requested
only once editing; a number picked from the catalogue whose view is edited in
the live table (a search), saved and shown after a reload; the view editor
asking before closing with changes; a saved view becoming a copy; the page
table's current view (sorted by title) becoming the screen default; sections
added, renamed, moved and removed, and widgets moved between them; a block's
JSON props refused (invalid JSON, `validateProps`), accepted and edited; a
block's `settings` form; "Done" refusing a screen with errors and naming the
widget, then saving once fixed; unavailable sources listed disabled with
their reasons. `e2e/dashboard.spec.ts` adds widgets through the new dialog.

## Tags columns

Both editions read `tags` on a column (`true` or `{ create, manage, bulk }`)
and `actions.tags` (`list`, `create`, `update`, `merge`, `remove`, each called
with the catalog's `{ tableId, tableType, columnId }`), and share
`tag-catalog.ts` (server-safe, synced to Vue) for everything that is not
rendering: column resolution, the cached catalog query
(`["yayaw-table", tableId, "tags", tableType, columnId]`, five minutes), the
catalog as options, search and create-on-the-fly names, what Enter does in a
picker (`tagPickerEnter`), bulk plans (`planTagBulkUpdate`, values or
`{ add, remove }` patch, `applyTagPatch` for hosts), merge and delete effects
on records and catalogs, usage counts from `aggregate` groups and the EN/FR
labels (overridden by `tags.<key>` translations).

- Catalog options: React's `TableProvider` loads the catalogs with
  `useQueries` and hands a `getTableConfig` whose tags columns carry the
  catalog's options, so every `useTableConfig` reader (cells, cards, filters,
  forms, details, charts, maps, kanban lanes) sees them; Vue's `YayawDataTable`
  turns `config.columns.definitions` into a shallow reactive array and swaps
  each tags column for a copy with the catalog's options as it loads or
  changes. Before the catalog loads, cells show pulsing placeholders for ids
  it would name; static `options` stay until then, and without
  `actions.tags` for good.
- Colors: `tagAppearance(value, coloredTags, map, color)` takes a tag's own
  color (a `TAG_COLOR_NAMES` palette name or a CSS color, as a tinted chip)
  over `tagColorMap` and the automatic hue, in cells, cards (Vue through
  `CellRenderer`), the Feed and pickers; filter menus show a swatch.
- Tag picker: React `components/tags/tag-picker.tsx` (Base UI combobox),
  Vue `components/tags/TagPicker.vue` (Reka combobox), same keyboard: arrows
  move, Enter picks the highlighted tag after typing or moving (else a typed
  name is picked or created, else the cell saves or the list closes),
  Backspace removes the last chip, Escape cancels a cell. Used by inline
  editing of tags columns, record form fields bound to a tags column (by
  `inlineEdit.formField`, `accessorKey` or id) and the bulk dialogs.
- Bulk "Add tags" / "Remove tags" (after bulk edit in the bulk bar, for tags
  columns holding lists, with `allowBulkEdit`, `canEditRow` and `bulkUpdate`
  or `update`): "Remove" offers the selection's tags with how many rows use
  each; applying patches the loaded rows at once (React: the `tableData`
  cache; Vue: the rows), then puts back the rows that fail (`failedIds` or a
  failed call), which stay selected, and reloads.
- "Manage tags" (column menu: React's header menu, Vue's column options):
  rename (Enter or leaving the field; empty and duplicate names refused),
  recolor (Default and the palette), merge into another tag and delete, both
  confirmed in the dialog (deletion with the records counted by one
  `aggregate` call). Changes are optimistic and restored on failure; merges
  and deletions rewrite the loaded rows. `table.canManageTags` and
  `tags.manage` gate it.
- Vue editable cells no longer open the record on a click: like React's
  editable cells (buttons), a double-click or Enter edits them.

Verification: `tests/tag-catalog-suite.ts` runs in both editions
(`tests/tag-catalog.test.ts` with React Query's client,
`packages/yayaw-table-vue/src/tag-catalog.test.ts` with Vue Query's): column
resolution, list answers, catalog options, one load per table and column and
reload after invalidation, search and create names, create on the fly and
selection, patches, values and patch plans, the selection's tags, merge,
delete and update effects, usage counts, labels, colors and the picker's
Enter; `tests/tag-catalog.test.ts` also checks the Vue copies are identical.
Component tests: `tests/tags.test.tsx` and
`packages/yayaw-table-vue/src/components/tags/tags.test.ts` (catalog names
and colors loaded once, create on the fly in a cell, bulk add in patch mode,
bulk remove in values mode with a partial failure, Manage tags, the record
form's field; Vue also static options without `actions.tags`).
`e2e/tags.spec.ts` on both demos (`?example=assets&assets-display=table`):
a tag created on the fly in a cell, a tag added to three rows in bulk then
filtered by, and a rename and a merge in "Manage tags".
