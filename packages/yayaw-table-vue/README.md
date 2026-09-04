# YaYaw Table Vue

The Vue 3 port of YaYaw Table. It keeps the React edition's config-driven API and action contracts while using Vue reactivity and `@tanstack/vue-table`.

## Included

- Table, Kanban, and Gallery display modes
- Local and server-side sorting, filtering, pagination, grouping, and search
- URL-backed state compatible with existing YaYaw table query keys
- Saved personal/team views with localStorage fallback
- Column visibility, ordering, pinning, and native drag-and-drop
- Row selection, bulk edit/copy/delete/export, and custom bulk actions
- Create/edit forms, sections, Zod validation, async options, and collections
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
The shortcut invokes the same handler as the reset button inside the Options
menu: column and advanced filters are cleared, configured default sorting and
column visibility are restored, and grouping is cleared. Native search, column
order/pinning, display mode, page size and the selected saved view are preserved,
matching the menu reset. It works with or without URL synchronization and never
changes another table's query parameters.

Both reset icons use the `reset` translation key for their accessible label and
tooltip (English and French defaults are included). The narrower
`useTableState().resetFilters()` API remains available for filtering-only resets.

### Catalogue-owned controls

Declare UI choices in `defineTableConfig`, not in a page-specific toolbar:

```ts
const config = defineTableConfig({
  // Keep each table's own id, columns, translations and form references.
  ...productCatalogue,
  table: {
    ...productCatalogue.table,
    actionsAsIcons: true,
    enableColumnPinning: true,
    enableAdvancedFilters: false,
    syncUrl: false,
    searchDebounceMs: 250,
  },
  toolbarActions: [{ id: "refresh", label: "Refresh", handler: ({ refresh }) => refresh() }],
});
```

The native column menu derives sorting, visibility and pinning actions from the
table/column capabilities. Set `enablePinning: false` on a column to remove its
pin controls. Mandatory columns cannot be hidden; selection stays locked left
and actions locked right. Sorting remains available from the keyboard-accessible
header label. Menus provide keyboard navigation, Escape dismissal and focus return.

Catalogue translation keys apply automatically. Explicit component props override
catalogue defaults; `toolbarActions: []` deliberately suppresses configured custom
actions. Server search debounce affects search only; filters, sort, pagination and
explicit refresh remain immediate, and pending searches are cancelled on unmount.

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
| dnd-kit | native pointer/HTML drag interactions |
| Next Server Actions | async action contract, compatible with Nuxt server APIs |

The public configuration and action vocabulary intentionally stays close to the React edition so applications can share backend contracts and most serializable table definitions.
