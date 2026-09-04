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

## Verification and distribution

`bun run test` registers all React tests through `bun:test` and preloads a browser environment for mounted form tests. `bun run vue:test` covers Vue and the shared fixtures. Run type checks, the Vue build, `registry:sync`, and `registry:pages` before publishing copied code. React test files are excluded from consumer registry output. Immutable released snapshots are unchanged by a feature PR.
