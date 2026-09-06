# YaYaw Table Vue

The Vue 3 port of YaYaw Table. It keeps the React edition's config-driven API and action contracts while using Vue reactivity and `@tanstack/vue-table`.

## Included

- Table, Kanban, and Gallery display modes
- Local and server-side sorting, filtering, pagination, grouping, and search
- URL-backed state compatible with existing YaYaw table query keys
- Saved personal/team views with localStorage fallback
- Column visibility, ordering, pinning, native drag-and-drop, and optional resizing
- Row selection, bulk edit/copy/delete/export, and custom bulk actions
- Create/edit forms, sections, Zod validation, async options, collections, and table pickers
- Inline cell editing with optimistic updates
- Text, code, JSON, image, URL, number, boolean, date, select, and multi-select cells
- Footer calculations and CSV export
- English/French defaults, custom translations, dark mode, responsive styling
- Vue Query caching, TypeScript declarations, Vitest coverage, and a shadcn-vue registry artifact

## Development

```bash
bun install
bun run vue:install
bun run vue:dev
bun run vue:test
bun run vue:build
```

The interactive demo runs at `http://localhost:5173`.

## Package usage

```ts
import { createApp } from "vue";
import { YayawTablePlugin } from "@yayaw/table-vue";
import "@yayaw/table-vue/style.css";

createApp(App).use(YayawTablePlugin).mount("#app");
```

Or import the component directly:

```vue
<script setup lang="ts">
import { DataTable, defineTableConfig } from "@yayaw/table-vue";
import "@yayaw/table-vue/style.css";

const config = defineTableConfig({
  id: "products",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text", inlineEdit: true },
      { id: "price", header: "Price", type: "number" },
      { id: "status", header: "Status", type: "select" },
    ],
    order: ["select", "name", "price", "status", "actions"],
    visible: ["name", "price", "status"],
    mandatory: ["name"],
  },
  table: {
    displayModes: ["table", "kanban", "gallery"],
    kanban: { groupBy: "status", titleColumn: "name" },
    gallery: { titleColumn: "name" },
    enableColumnResizing: true,
  },
  translations: { namespace: "products", keys: { title: "Products" } },
});
</script>

<template>
  <DataTable table-type="products" :config="config" :data="products" />
</template>
```

## Server actions

### Toolbar shortcuts

Set `table.actionsAsIcons: true` to render toolbar and bulk actions as icons.
Set `table.showResetFilters: true` to show a dedicated reset icon next to the
Options menu. It is disabled by default for compatibility with existing tables.
The shortcut clears search, column and advanced filters, and returns to the first
page. Sorting, grouping, column visibility/order/pinning, display mode, page size,
and the selected saved view are preserved. `showClearFilters` is the preferred
name; `showResetFilters` remains a compatible alias with the same React/Vue
behavior. The reset command inside Options separately restores presentation
defaults. Both work with or without URL synchronization.

The clear shortcut uses the `clearFilters` translation key and the Options reset
uses `reset` (English and French defaults are included).

### Catalogue-owned controls

Declare UI choices in `defineTableConfig`, not in a page-specific toolbar:

```ts
const config = defineTableConfig({
  // Keep each table's own id, columns, translations and form references.
  ...productCatalogue,
  table: {
    ...productCatalogue.table,
    actionsAsIcons: true,
    enableColumnDnd: true,
    enableColumnDragDropByDefault: false,
    enableColumnPinning: true,
    enableAdvancedFilters: false,
    syncUrl: false,
    searchDebounceMs: 250,
  },
  toolbarActions: [{ id: "refresh", label: "Refresh", onClick: ({ refresh }) => refresh() }],
});
```

The native column menu derives sorting, filtering, visibility and pinning actions from the
table/column capabilities. `enableColumnDnd` gates column reordering and its UI,
while `enableColumnDragDropByDefault` defines the initial user preference. Users
can change that preference from a column menu or Properties, and it is persisted
per table. Set `enablePinning: false` on a column to remove its
pin controls. Mandatory columns cannot be hidden; selection stays locked left
and actions locked right. Sorting remains available from the keyboard-accessible
header label. Menus provide keyboard navigation, Escape dismissal and focus return.

Set `enableColumnResizing: true` on the table to expose resize handles. Pointer
and touch dragging resize continuously; focused handles accept Left/Right Arrow,
Home, and End, and a double-click restores the configured width. Set
`enableResizing: false` on an individual column to keep it fixed. Widths are
stored in saved views and shareable URLs.

`toolbarActions` accepts a static array or a function of the live action context,
matching React. The context includes selected IDs/rows, counts, permissions,
layout mode, export state, table metadata, actions, refresh, and selection reset.
Use `toolbarActionsPlacement` with `before-create`, `between-create-export`,
or `after-export`. The earlier `handler` callback remains accepted as an
alias for `onClick`.

Catalogue translation keys apply automatically. Explicit component props override
catalogue defaults; `toolbarActions: []` deliberately suppresses configured custom
actions. Server search debounce affects search only; filters, sort, pagination and
explicit refresh remain immediate, and pending searches are cancelled on unmount.

### Saved views

With `table.enableViews`, the toolbar shows the current view in a keyboard-accessible menu. The save icon updates a modified, editable view; the plus icon opens a dialog to save a new view. The menu also offers the catalogue's default view, saved views, and deletion of the active editable view. `allowViewSave: false` hides write actions; `allowViewSharing` enables sharing in the dialog. System views can be selected and copied but cannot be updated or deleted.

`actions.views` can provide `list`, `create`, `update`, and `delete` individually, with local storage as the fallback for omitted handlers. Every action receives `tableId` and `tableType`; update/delete also receive the view ID. English and French labels are included. Existing flat Vue translation keys and corresponding React `views.*` keys are accepted, with explicit React keys taking precedence.

An incoming URL with table options keeps those options, including unsaved changes to a referenced view. A URL containing only `view=<id>` restores that view. Without URL state, `initialActiveViewId` takes precedence over an `isDefault` view. With URL synchronization disabled, unrelated URL parameters are ignored. Default/partial views restore catalogue defaults rather than inheriting the previous view's display options. Empty grouping is saved explicitly, so configuring Kanban lanes does not group the table after saving or reloading a view. Pending loads and writes do not discard newer table edits; failed writes preserve the draft and expose a retryable error.

### List and mutation handlers

The same `getTableActions(tableType)` pattern is supported. Actions may be regular API-client functions, Nuxt server functions, or RPC calls.
The `list` action receives a one-based `page` value, matching the React edition; URL pagination remains zero-based internally.

```ts
const getTableActions = () => ({
  list: async ({ page, pageSize, search, filters, advancedFilters, sorting }) => {
    const result = await $fetch("/api/products", {
      query: { page, pageSize, search, filters, advancedFilters, sorting },
    });
    return { data: result.rows, meta: { totalCount: result.total, pageCount: result.pages } };
  },
  create: (data) => $fetch("/api/products", { method: "POST", body: data }),
  update: (id, data) => $fetch(`/api/products/${id}`, { method: "PATCH", body: data }),
  delete: (id) => $fetch(`/api/products/${id}`, { method: "DELETE" }),
});
```

`DataTable` creates a local Vue Query client by default. Pass `:query-client="queryClient"` to share the application's cache.

## Bulk actions

With `getFormConfig` and `actions.bulkUpdate`, bulk editing automatically opens the table's existing catalogue form. No `onBulkEdit` callback or separate application form is required. Each table keeps its own columns, form configuration, and action provider; the library only shares the rendering engine.

```ts
const getFormConfig = () => defineFormConfig({
  id: "products",
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "price", label: "Price", type: "number", min: 0 },
    { name: "active", label: "Active", type: "switch" },
    { name: "sku", label: "SKU", type: "text", bulkEdit: false },
  ],
});
const getTableActions = () => ({
  update: (id, patch) => api.updateProduct(id, patch),
  bulkUpdate: (ids, patch) => api.updateProducts(ids, patch),
});
```

The editor initializes common values and asks users to check each field they want to apply. Unchecked fields are omitted, while explicitly checked `false`, `0`, empty strings, empty arrays, and `null` remain valid patch values when permitted by the field's validation. Required rules and field-level Zod schemas apply only to checked fields. Hidden and disabled predicates are checked against every target row, including explicitly changed dependencies. Set `field.bulkEdit: false` for unique or unsafe fields; IDs and timestamps are excluded automatically.

The single-row `loadInitialValues` callback and full-row `schema` are not run for bulk edits. Include the data needed by conditional fields in the selected records. `transform` receives only the selected field patch and `context.bulkEdit` (`ids`, `rows`, and `fields`); it must preserve patch semantics instead of reconstructing an entire row. Validate authorization, uniqueness, and cross-field business rules on the server as usual. Selections resolving to different `resolveEditFormType` values cannot share one generated bulk editor.

Target IDs are captured when the editor opens. A failed update keeps the draft and selection. For partial success, return the complete subset of failed targets:

```ts
return { success: false, failedIds: ["product-2"], error: "One product could not be updated." };
```

Successful targets are refreshed and removed from the selection, and retry only submits the remaining IDs. If completion is unknown, omit `failedIds` so no target is silently treated as successful. New selections are never included in an already-open operation.

Without a catalogue provider, the legacy JSON editor remains the default. Set `form.bulkEditMode: "catalogue"` to generate fields from columns, or `form.bulkEditMode: "json"` to explicitly retain the JSON workflow. `onBulkEdit` still takes precedence when the application intentionally owns editing. The other callbacks (`onBulkCopy`, `onBulkDelete`, `onBulkExport`) retain their existing contracts.

Callbacks and custom bulk actions can return a result that controls feedback, selection, and menu state independently:

```ts
return {
  success: true,
  message: "Products archived",
  clearSelection: true,
  closeMenu: true,
};
```

Returning `void` leaves follow-up behavior to the application. Failed results preserve the selection by default. When individual fallback deletions partly fail, the table refreshes the successful mutations and retains only the failed IDs for retry.

## Table picker form fields

Use `tablePicker` when a relation needs the native table experience instead of a
finite select. The field renders its own catalogue, server search, filters,
sorting, pagination, saved views, and row selection inside the generated form.
No custom component or form renderer is required.

```ts
const mediaPicker = defineTableConfig({
  id: "media-picker",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "type", header: "Type", type: "select", options: mediaTypes },
      { id: "country", header: "Country", type: "select", options: countries },
    ],
    mandatory: ["name"],
    order: ["select", "name", "type", "country"],
    visible: ["name", "type", "country"],
  },
  table: { showToolbarHeader: false },
  translations: { namespace: "mediaPicker", keys: { title: "Media" } },
});

const form = defineFormConfig({
  id: "collection",
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    createTablePickerField({
      name: "mediaIds",
      label: "Media",
      required: true,
      tablePicker: {
        tableType: "media-picker",
        config: mediaPicker,
        actions: { list: listMedia },
        getRowId: (row) => String(row.id),
        parseValue: Number,
      },
    }),
  ],
});
```

Selection is controlled by the form value and survives search, filter, sort,
group, and pagination changes. `parseValue` preserves typed relation IDs;
without it, selected values are strings. Set `multiple: false` for a scalar
field, `selectOnRowClick: false` to require the checkbox, or `maxHeight` to
change the scrolling body limit. The nested table does not synchronize with the
page URL unless `syncUrl: true` is explicit. Mutating table actions and exports
are suppressed in picker mode; `list`, `aggregate`, and `views` remain available.
Use `optionDependencies` on the field when changes to other form values should
recreate a context-derived picker catalogue.

## Locked utility columns

The selection column stays visible at the far left and row actions stay visible at the far right whenever those features are enabled. Neither utility column can be moved or unpinned, including through URL state or saved views. Mandatory data columns cannot be hidden. Data columns remain independently reorderable and pinnable, and calculation footers follow the same pinned order as the header and body.

## Nuxt

The component is SSR-safe: browser APIs are accessed only after mount. Register it in a client plugin when the table should be globally available:

```ts
// plugins/yayaw-table.client.ts
import { YayawTablePlugin } from "@yayaw/table-vue";
import "@yayaw/table-vue/style.css";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(YayawTablePlugin);
});
```

## Registry

Build the standalone shadcn-vue registry item:

```bash
bun run --cwd packages/yayaw-table-vue registry:build
```

The result is written to `packages/yayaw-table-vue/public/r/yayaw-table-vue.json` and can be installed with:

```bash
pnpm dlx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
```

## React-to-Vue mapping

| React edition | Vue edition |
| --- | --- |
| `@tanstack/react-table` | `@tanstack/vue-table` |
| React Query | Vue Query |
| React hooks/Jotai | refs, computed values, provide/inject |
| Nuqs | SSR-safe URL state composable |
| React components/ReactNode | Vue SFCs, components, and VNode renderers |
| dnd-kit | native pointer drag plus keyboard column and Kanban move controls |
| Next Server Actions | async action contract, compatible with Nuxt server APIs |

The public configuration and action vocabulary intentionally stays close to the React edition so applications can share backend contracts and most serializable table definitions.
