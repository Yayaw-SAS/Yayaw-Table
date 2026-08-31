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
