# React and Vue parity

The two registries remain independently installable. Their shared adapter lives in `src/components/ui/yayaw-table/utils/table-contracts.ts`; `bun run contracts:sync` copies it to the Vue source before registry generation. `tests/fixtures/parity.json` exercises both filtering implementations and both list contracts.

## Release contract

React and Vue are editions of the same product. A consumer-facing change is ready to merge only when both editions expose equivalent public contracts and observable outcomes, with equivalent regression coverage and no known functional gap. Framework primitives and internal component structure may differ when their behavior remains equivalent.

Every parity-affecting PR must update this document and keep the Vue example at `packages/yayaw-table-vue/demo/App.vue` representative of the React example. Public API, behavior, default, setup, example, or migration changes also require matching English and French documentation in [`Yayaw-SAS/Yayaw`](https://github.com/Yayaw-SAS/Yayaw), including an exact protected seed transition for the database-backed documentation system.

## Actions and views

List actions receive both naming conventions:

| Value | Accepted/emitted names |
| --- | --- |
| Page | `page`, starting at **1** |
| Page size | `limit` and `pageSize` |
| Sort | `orderBy` object and `sorting` array, preserving every sort |
| Search | `search`, `q`, and `globalSearch` |
| Column filters | `filters` object |
| Advanced filters | Active `advancedFilters` array and `advancedFilterJoin` (`and`/`or`) |

URL page indexes remain zero-based. Invalid page sizes fall back to defaults. Existing action handlers can keep reading their original names. Aggregation receives the filter join operator too. Vue accepts primitive aggregate results and React's `{ raw, label }` values.

Advanced filter input accepts either an array or `{ filters, joinOperator }`. Inactive rules do not filter rows. An OR envelope retains its join when converted to an array. The local engines understand both select operator families: `is`/`isNot`/`isAnyOf`/`isNoneOf` and `equals`/`notEquals`/`in`/`notIn`, plus multi-select membership operators. Date equality covers the whole calendar day. Remote handlers remain responsible for applying the supplied filters and join operator.

Saved views accept canonical `globalSearch`, `columnFilters`, and `columnPinning`, as well as Vue's earlier `search`, `filters`, and `pinning`. Canonical values take precedence when both are present. Legacy Kanban grouping is migrated to `grouping`. Vue applies a default view when there is no requested view or explicit table URL state, protects system views from update/deletion in the UI, indicates modified views, and preserves drafts when persistence fails.

## Catalogue forms

Both editions can generate standard fields from column definitions when the catalogue has no matching form. Register a form to customize validation, conditional behavior, labels, or field rendering. Existing React TanStack Form instances, factories, custom field renderers, and custom collection editors remain supported.

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

When `onBulkEdit` is absent, `actions.bulkUpdate(ids, patch)` opens the React catalogue bulk editor. A supplied callback keeps precedence. The editor captures the selected IDs, starts with values common to all targets, and applies only checked fields. It uses each row's edit permission and conditional field rules. Reserved identity/timestamp fields and fields with `bulkEdit: false` are excluded. Rows resolving to different form types cannot share an editor.

`context.bulkEdit` exposes `ids`, `rows`, and checked `fields`. Field and collection validation still applies, while the full-row schema is omitted because untouched required fields need not exist in a patch. A form transform receives the checked-field patch.

Return `{ success: false, failedIds: ["remaining-id"], error: "..." }` for a partial failure. `failedIds` must be the complete subset still requiring an update. Successful targets are removed from the selection, and retry sends only the remaining IDs with the retained draft. A failure without `failedIds` retains every target. Invalid completion reports never silently clear targets.

## Cards, inline editing, and reset

Vue gallery and Kanban use the same pagination state as the table. Local rows are filtered and sorted before slicing; server pages are not sliced twice. Kanban grouping follows toolbar grouping, configured lanes apply only to their configured field, and rejected updates restore the previous lane. Card properties use the column renderer, and image cells accept HTTP(S), relative paths, blob URLs, and supported image data URLs.

React inline editing resolves the catalogue for each row and honors hidden/disabled predicates, row permissions, asynchronous field validation, and schema transforms. Collections, custom fields, and remote pickers use the full catalogue editor.

Vue inline editing honors the column/table `debounceMs`, validates against the catalogue, cancels unsaved timers on Escape/unmount, and keeps errors available for correction. `allowInlineEdit` now defaults to `true` in both editions; actual cell editing remains opt-in through table or column `inlineEdit.enabled`.

Use **`showClearFilters: true` in either framework** to clear search, column filters, advanced filters, and pagination while preserving sorting, grouping, column visibility/order/pinning, page size, display mode, and the selected view. The historical `showResetFilters` option remains a supported alias and invokes this same behavior in both editions. The reset command inside Vue Options remains a separate presentation reset.

Both editions distinguish the column drag-and-drop feature gate from the user's preference. Set `enableColumnDnd: false` to remove the controls and disable reordering. `enableColumnDragDropByDefault` supplies the initial preference and now defaults to `false` in both editions; users can toggle it from a column menu or the Vue Properties panel, and the choice is stored per table. Vue column headers include a keyboard drag handle. Vue Kanban cards expose previous/next lane controls alongside pointer dragging, matching the keyboard outcome provided by React's drag system.

Set `enableColumnResizing: true` to expose resize handles on data columns. Pointer and touch dragging update widths continuously; keyboard users can focus a handle and use Left/Right Arrow in 10-pixel steps, Home for the minimum, and End for the maximum. Double-clicking a handle restores its configured size. Set `enableResizing: false` on an individual column to keep it fixed. Selection and actions columns are always fixed. Valid widths are stored in `columnSizing`, restored by saved views, and included in shareable table URLs. The feature defaults to `false` in both editions so existing layouts remain unchanged.

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
| Display modes | Shared grouping and pagination, card renderers, configurable empty state, one-page pagination hiding | Vue `parity.test.ts`; React gallery/Kanban suites |
| Kanban updates | Permission-aware moves, optimistic update, rollback and accessible non-pointer movement | Vue `parity.test.ts`; React Kanban suites |
| Selection | Controlled state, cross-page cache, select-all race protection, optional query persistence | React `selection-parity.test.tsx`; Vue component/action suites |
| Catalogue forms | Generated fields, conditions, async values/options, nested collections, validation, transforms, patch mode | Shared `form-scenarios.json`; both form-contract suites and mounted form suites |
| Table picker | Local/server query, controlled single/multiple selection, typed IDs, isolated URL state | React `table-picker-parity.test.tsx` and picker unit tests; Vue form-component tests |
| Bulk actions | Permissions, catalogue editing, frozen targets, partial failure retry, callback precedence | Shared bulk fixtures; React form/bulk suites; Vue bulk suites |
| Inline editing | Catalogue validation, debounce, cancellation, permissions, optimistic rollback | React inline-form suites; Vue inline-edit suites |
| Export and refresh | All matching pages, current query/order, partial-result protection, mutation refresh/clamping | Shared paginated fixtures; both action suites |
| Accessibility and i18n | Translated controls, menu/dialog focus, row activation, column/Kanban keyboard alternatives | Vue keyboard suites; React mounted interaction suites |
| URL state | Compatible query keys when enabled; isolated in-memory state when disabled | React `url-sync-parity.test.tsx`; Vue state/catalogue-control suites |
| Distribution | Generated React and Vue registries plus repository Vue example | Type checks, full tests, Vue builds, registry sync/pages build |

## Verification and distribution

`bun run test` registers all React tests through `bun:test` and preloads a browser environment for mounted form tests. `bun run vue:test` covers Vue and the shared fixtures. Run type checks, the Vue build, `registry:sync`, and `registry:pages` before publishing copied code. React test files are excluded from consumer registry output. Immutable released snapshots are unchanged by a feature PR.
