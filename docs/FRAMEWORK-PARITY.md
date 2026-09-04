# React and Vue compatibility

The two registries remain independently installable. Their shared adapter lives in `src/components/ui/yayaw-table/utils/table-contracts.ts`; `bun run contracts:sync` copies it to the Vue source before registry generation. `tests/fixtures/parity.json` exercises both filtering implementations and both list contracts.

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

Vue inline editing honors the column/table `debounceMs`, validates against the catalogue, cancels unsaved timers on Escape/unmount, and keeps errors available for correction. Enable it with `allowInlineEdit: true` and table or column `inlineEdit.enabled`; the existing Vue opt-in defaults are preserved.

Use **`showClearFilters: true` in either framework** to clear search and filters while preserving display options. The historical `showResetFilters` option keeps its existing behavior: React clears filters; Vue restores the Options defaults while preserving search. This avoids changing existing Vue interfaces unexpectedly.

Both editions distinguish the column drag-and-drop feature gate from the user's preference. Set `enableColumnDnd: false` to remove the controls and disable reordering. `enableColumnDragDropByDefault` supplies the initial preference; users can toggle it from a column menu or the Vue Properties panel, and the choice is stored per table.

## Export, selection, and refresh

Toolbar export retrieves **all matching rows**, respecting the current search, column filters, advanced-filter join, and sort. Vue applies the same query to local data before export. Server export and select-all use the shared page collector; a server page-size cap does not truncate results when `meta.pageCount` or `meta.totalCount` describes the full result. Without metadata, a short page ends the collection. An inconsistent empty page, a failed request, or the 1,000-page limit reports an error instead of handing partial rows to the export callback. An export already in progress keeps the query and column order captured when it started; its button stays disabled until completion.

CSV export includes visible data columns in display order. Bulk export includes only selected rows. The `onExport` and `onBulkExport` callbacks retain their existing signatures and take precedence over the built-in download.

Both editions retain selected records across page and page-size changes. Deselecting one row keeps the other selected rows, including rows outside the current page. Returning to a page replaces cached selected records with the freshly loaded versions. Changing search, filters, sort, or grouping clears the selection. A delayed select-all result cannot replace a newer selection or query, and select-all respects row selection permissions. Provide stable row IDs (or `getRowId`) for server pagination; positional indexes cannot identify records across pages. Off-page selected rows retain their last loaded values until fetched again.

Vue refreshes the active list after built-in mutations and table query invalidation. Invalidating an aggregate or an older cached page does not reload the visible list. If a deletion removes the last server page, the table requests the preceding valid page; local data shrinkage also clamps pagination. Consumer-owned action callbacks remain responsible for their own persistence and follow-up refresh unless their documented result explicitly requests library handling.

## Filter editing and keyboard interactions

Vue advanced filters use the same operator families as React. A new rule starts inactive; changing the column resets its data type, operator, and values. Numeric/date ranges expose two inputs. Select and multi-select rules preserve multiple primitive values, including numeric zero and boolean false. Existing Vue operator aliases remain editable when loaded from saved views or URLs. Apply validates and commits the draft; Escape restores the last applied rule. Rules can be disabled without removing their values.

Filter controls use the React `filters.*` translation keys, with English and French defaults. Table feedback and reusable field/collection controls inherit the table translations; standalone fields retain their English fallbacks. Date-only values from native inputs represent a local calendar date in both editions, including time zones west of UTC. The Options panel and row menus move focus when opened and restore it on dismissal. Row menus support arrow keys, skip disabled actions, and use a modal confirmation with trapped focus for deletion. A failed deletion retains its confirmation for retry.

## Plan verification map

This map follows the six steps of the accepted parity plan. It describes behavioral parity; framework-specific renderers and existing compatible configuration aliases remain supported.

| Plan step | Implementation | Regression evidence |
| --- | --- | --- |
| 1. Shared action, request, filter and view contracts | `table-contracts.ts`, framework list adapters, saved-view normalization, aggregate result labels | Shared `parity.json` fixtures; both `contracts-parity.test.ts` suites; Vue `parity.test.ts`, `saved-views.test.ts`, `use-table-state.test.ts`; React view-state and bulk-action suites |
| 2. Catalogue forms in both editions | Generated field fallback, conditional fields, async initial values/options, field/root validation, transforms, patch mode, nested `itemFields`, retained custom renderers | Shared `form-scenarios.json` and both `form-contracts.test.ts` suites; mounted React `form-parity.test.tsx`; Vue `form-components.test.ts` and `form-runtime.test.ts` |
| 3. React catalogue bulk editing | Common initial values, checked-field patches, frozen targets, permissions, partial failure retry, callback precedence | Shared bulk completion fixtures; mounted React `form-parity.test.tsx`; React bulk-action tests; Vue `bulk-form.test.ts` and bulk-action tests |
| 4. Table behavior | Shared page state for table/cards, current grouping, Kanban rollback, inline debounce, distinct clear/reset controls | Vue `parity.test.ts`, `table-actions-parity.test.ts`, `inline-edit.test.ts`, `filter-reset.test.ts`; React filter-reset and inline-form tests |
| 5. Interaction parity | Default/system views, card renderers/images, translations, keyboard menus/dialogs, ordered visible-column exports, documented selection/refresh behavior | Vue saved-view, catalogue-control, advanced-filter and row-action keyboard tests; React `selection-parity.test.tsx`; shared paginated fixtures; browser checks for views, filters, menus and selection |
| 6. Durable verification and distribution | Shared business fixtures executed in both test runners, framework-specific mounted tests, generated registries, compatibility documentation, Changesets | CI runs React/Vue suites, TypeScript, Vue build and static registry generation; published version snapshots are left unchanged |

## Verification and distribution

`bun run test` registers all React tests through `bun:test` and preloads a browser environment for mounted form tests. `bun run vue:test` covers Vue and the shared fixtures. Run type checks, the Vue build, `registry:sync`, and `registry:pages` before publishing copied code. React test files are excluded from consumer registry output. Immutable released snapshots are unchanged by a feature PR.
