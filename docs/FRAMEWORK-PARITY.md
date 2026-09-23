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

Both managers support one personal favorite per table, separate from shared view records. The star is available for saved system/shared views even with saving disabled. Arrival priority is explicit URL state, `initialActiveViewId`, an accessible favorite, then `isDefault`. Optional `getFavorite`/`setFavorite` actions synchronize preferences; otherwise persistence is browser-local. Organization scoping and permissions remain the host's responsibility; see [saved views](SAVED-VIEWS.md).

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

URL page indexes remain zero-based. Invalid page sizes fall back to defaults. Existing action handlers can keep reading their original names. Aggregation receives the filter join operator too. Vue accepts primitive aggregate results and React's `{ raw, label }` values.

Advanced filter input accepts either an array or `{ filters, joinOperator }`. Inactive rules do not filter rows. An OR envelope retains its join when converted to an array. The local engines understand both select operator families: `is`/`isNot`/`isAnyOf`/`isNoneOf` and `equals`/`notEquals`/`in`/`notIn`, plus multi-select membership operators. Date equality covers the whole calendar day. Remote handlers remain responsible for applying the supplied filters and join operator.

Saved views accept canonical `globalSearch`, `columnFilters`, and `columnPinning`, as well as Vue's earlier `search`, `filters`, and `pinning`. Canonical values take precedence when both are present. Legacy Kanban grouping is migrated to `grouping`. Vue applies a default view when there is no requested view or explicit table URL state, protects system views from update/deletion in the UI, indicates modified views, and preserves drafts when persistence fails.

Saved snapshots now include the effective `density` (XS through 2XL). Applying or resetting a legacy view without density restores the configured table default. Both editions load persisted views on mount when no initial views are provided, including after a full reload. Density participates in dirty detection; it remains local until a view is saved and is not an independent URL parameter.

React ignores repeated writes of equivalent table state in both URL and memory modes, preventing column-order synchronization from retriggering subscribers during an action refresh.

The Create button is the final toolbar action and keeps the primary style, in text and icon modes. Built-in secondary actions remain outlined. Existing custom placement values remain accepted: `before-create` and `between-create-export` put custom actions before Export; `after-export` puts them after Export. Create follows all of these groups.

Vue Kanban and Gallery controls use Reka UI Select, DropdownMenu, and Checkbox primitives with the same Shadcn-style tokens as the existing menus. This includes card page-size selection and Lucide icons for lane movement. Keyboard navigation, multi-choice property menus, focus restoration, disabled card selection, translated labels, and saved card options have regression coverage. The public configuration and saved-view formats are unchanged.

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

## Behavioral parity matrix

The parity contract covers user-visible behavior and serializable catalogue/action contracts. Component names, framework primitives, DOM structure, slots, and framework-native escape hatches remain specific to React or Vue.

| Surface | Shared behavior | Regression evidence |
| --- | --- | --- |
| Defaults and feature gates | Common defaults for editing, filters, column DnD/pinning, grouping, pagination, selection, views, debounce, URL state, and page sizes | Shared `behavior-defaults.json`, executed by both test runners |
| List/filter/view contracts | One-based action pages, both page-size/search aliases, multi-sort, simple and advanced filters, aggregate labels, normalized saved views | Shared `parity.json`; both `contracts-parity.test.ts` suites; view-state suites |
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
header, accessor value, and option labels (including zero and false). Headings
count leaf records across nested groups and never aggregate unrelated category IDs.
Expanded records retain all their ordinary cell values. Synthetic headings do not
activate or edit a record, and their selection controls only select permitted leaf
IDs. Selection-disabled tables use the full visible column span. Groups initially
expand when grouping changes; subsequent toggles remain local presentation state.

Enable `table.enableGrouping` and `table.showToolbar`, and keep eligible column
`enableGrouping` flags enabled. Grouping is local to the supplied records: a server
that paginates before returning records produces page-local groups.

Coverage: shared `tests/fixtures/grouped-rows.json`, React `tests/grouped-rows.test.tsx`,
and Vue `src/grouped-rows.test.ts`, plus browser interaction in both editions.

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

Equivalent shared fixtures cover the four dependency types, signed/calendar offsets, summaries,
source identity collisions, invalid/cyclic/incomplete graphs, flags, permissions, stale previews,
atomic failure and idempotent retries. The shared timeline suite covers the week origin, zoom widths
and navigation steps, inclusive bar spans, collapsed ancestors, the centred date marker, the edit and
resize flags, and the mutations a pointer or arrow key produces. DOM tests cover draft retention,
exact relation previews, cancellation and instance isolation in the dialog; per-edition component
tests cover each timeline's own wiring. Both editions use the same bounded virtual timeline; hidden
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

## List view

`displayModes: ["list"]` renders one line per record in both editions: the
selection checkbox, the title column, the chosen properties and the row actions.
`table.list` sets `titleColumn`, `cardColumnIds` and `showCardLabels`; without
`cardColumnIds` every non-title data column is shown. The grouped column is
omitted from properties and lines are sectioned by the first grouping level
(`maxGroups: 1`), headed "Column: value" with a count; empty values read
"No value". Settings are saved in views and in the `<tableId>-list` URL key, and
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

`utils/value-format.ts` (synced to Vue) formats number and date cells in both
editions. `numberFormat` accepts the historical presets (`"space"`, `"dot"`,
`"comma"`, `"locale"`), React's `decimals` and Vue's `decimalPlaces`, and adds
`style` (`decimal`, `currency`, `percent`, `compact`, `unit`), currency and unit
display, min/max fraction digits, separators applied to any style,
`prefix`/`suffix`, `signDisplay`, `negative: "parentheses"`, `percentBase`
(`fraction` or `whole`) and `display: "bar"` with `max` for a progress bar.
Dates share the 17 presets, `dateFormat` patterns, `timeZone` and `hour12`;
`"relative"` uses `Intl.RelativeTimeFormat` in the table locale. Date-only
strings are local calendar days in both editions.

Known difference kept for compatibility: a number column without
`numberFormat` shows the raw value in React (`1234.5`) and a locale-grouped
value in Vue (`1,234.5`). Set `numberFormat` for identical output.
`tests/value-format-suite.ts` runs in both editions.

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
