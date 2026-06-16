# YaYaw Table

Flexible, type-safe data table for React. One component, clean API, minimal boilerplate. Built on **TanStack Table** with first-class TypeScript support. Data and state can be driven by **Next.js Server Actions** and **Nuqs** (URL state).

## Features

- **Simple API** – One component to render a full data table; pass `getTableConfig` and `getTableActions` and you’re set
- **Server-first** – Built for Next.js 15 and 16 with Server Actions for list/create/update/delete and bulk operations
- **URL state** – Sort, filters, and pagination in the URL via [Nuqs](https://nuqs.io) (optional)
- **Saved views** – Users can save and restore URL-backed table setups such as filters, sort, search, column layout, display mode, grouping, pinning, and page size
- **Display modes** – Keep the default table view or add a Notion-style Kanban view grouped by one of your columns
- **Built-in UX** – Sorting, pagination, grouping, column visibility, column reorder (drag-and-drop), global search
- **Filters** – Column filters and advanced filters panel; filter presets supported
- **Number & currency** – Right-aligned number columns with configurable format (thousands/decimal separators, prefix/suffix)
- **Column types** – Text, tag, number, boolean, date; extensible via `columnTypeMapping`
- **Bulk actions** – Edit, copy, export (CSV), delete, and typed custom actions for selected rows
- **Type-safe** – Strong TypeScript types out of the box
- **Accessible** – Keyboard navigation and ARIA-friendly UI
- **Tailwind-ready** – Easy to style; works with Shadcn UI

## Requirements

- React 19+
- Next.js 15 or 16 (recommended; can be used in other React setups with your own data layer)
- Project already initialized with [Shadcn UI](https://ui.shadcn.com) and `components.json` with `"aliases": { "ui": "@/components/ui" }`

## Installation (Shadcn Registry)

From your project root:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
```

To install a pinned release instead of the moving latest registry item:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
```

If your project has the `@yayaw` registry namespace configured:

```bash
pnpm dlx shadcn@latest add @yayaw/yayaw-table
# or
npx shadcn@latest add @yayaw/yayaw-table
# or
yarn dlx shadcn@latest add @yayaw/yayaw-table
# or
bunx --bun shadcn@latest add @yayaw/yayaw-table
```

With shadcn CLI v4, the site root also supports content negotiation for CLI
requests:

```bash
npx shadcn@latest add https://table.yayaw.app
```

The CLI copies the code to `components/ui/yayaw-table` (or your `ui` alias) and installs required dependencies.

Optional CLI v4 registry items are available for new projects that want a
YaYaw-ready baseline:

```bash
npx shadcn@latest add @yayaw/yayaw-table-base
npx shadcn@latest add @yayaw/font-yayaw-sans
```

These are additive. Installing `yayaw-table` directly remains the default
backward-compatible path.

Useful shadcn CLI v4 inspection commands:

```bash
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json --dry-run
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json --diff
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json --view
npx shadcn@latest view @yayaw/yayaw-table
npx shadcn@latest search @yayaw
npx shadcn@latest list @yayaw
npx shadcn@latest info --json
```

## Quick start

```tsx
import { DataTable } from "@/components/ui/yayaw-table";
import { getTableConfig, getTableActions } from "./table-config";

export const MyTable = () => (
  <DataTable
    tableType="products"
    getTableConfig={getTableConfig}
    getTableActions={getTableActions}
    title="Products"
  />
);
```

You need at least **getTableConfig** (columns, table options) and **getTableActions** (e.g. **list** for data). For Next.js with URL state, add the **NuqsAdapter** in your layout (see [Provider & Setup](./content/docs/setup.mdx)).

Common props:

- **tableType** – Your table configuration key
- **getTableConfig** / **getTableActions** – Configuration and server actions resolver
- **loadingOverlay** – Custom loading UI
- **onRowSelectionChange**, **onBulkDelete**, **onBulkEdit**, **onBulkCopy**
- **customBulkActions** – Add selected-row actions to the bulk actions menu
- **initialViews** / **initialActiveViewId** – Seed saved table views before your view actions load
- **enableAdvancedFilters** – Toggle advanced filters UI
- **columnTypeMapping** – Map backend data types to internal renderers

## Saved views

YaYaw Table includes a saved views manager above the table. A view stores the same state that is already represented in URL params: search, filters, advanced filters, sorting, column visibility, column order, display mode, Kanban settings, Gallery settings, row grouping, pinning, and page size. Applying a view updates the URL-backed state and resets pagination to the first page.

Use `table.allowViewSave: false` when users can select existing views but should not create, update, or delete them. Use `table.allowViewSharing: true` to show the “Share with team” option when saving a view; the value is sent to `views.create` as `input.isGlobal`.

## Display modes

Tables render in `"table"` mode by default. Add `"kanban"` and/or `"gallery"` to `table.displayModes` to show a compact display switcher next to saved views. Kanban is powered by Kibo UI primitives while keeping the same data, URL state, row actions, selection, filters, sorting, and saved-view model as the table view. Gallery renders the same rows as responsive image cards and uses `type: "image"` columns for media. Card property labels are hidden by default for a cleaner scan in both Kanban and Gallery; set `kanban.showCardLabels` or `gallery.showCardLabels` to `true` when a denser labeled card is better.

```ts
table: {
  displayModes: ["table", "kanban", "gallery"],
  defaultDisplayMode: "table",
  kanban: {
    groupBy: "status",
    titleColumn: "name",
    cardColumnIds: ["brand", "category", "price"],
    groups: [
      { value: "In Stock" },
      { value: "Low Stock" },
      { value: "Out of Stock" },
    ],
    allowDragUpdate: true,
  },
  gallery: {
    imageColumn: "imageUrl",
    titleColumn: "name",
    cardColumnIds: ["brand", "category", "price", "status"],
    aspectRatio: "square",
    imageFit: "cover",
    cardSize: "medium",
  },
}
```

When Kanban is active, the toolbar shows lane, title, property, and label controls; overrides are stored in `{tableId}-kanban` and in saved views. Older links using `{tableId}-kanbanGroupBy` are still read as a legacy fallback. When `allowDragUpdate` is enabled, moving a card between lanes calls your `update` action with the grouped column value. Your backend should still validate whether that transition is allowed. When Gallery is active, the toolbar shows media, title, property, ratio, fit, size, and label controls; overrides are stored in `{tableId}-gallery` and in saved views.

For prototypes, the copied component falls back to localStorage so the UI is usable without a backend. In production, expose database-backed view actions from `getTableActions`:

```tsx
const getTableActions = (tableType: string) => ({
  list: listProducts,
  views: {
    list: async ({ tableId }) => ({ data: await db.views.list(tableId) }),
    create: async (input) => await db.views.create(input),
    update: async (id, input) => await db.views.update(id, input),
    delete: async (id, context) => await db.views.delete(id, context),
  },
});
```

For the recommended database shape, use one generic `table_views` table keyed by a stable application `table_key` rather than SQL table names. See [URL state and saved views](./content/docs/url-state.mdx).

## Documentation

Docs live in this repo under `content/docs/`. Full documentation (when the site is built) is available there:

- [Getting started](./content/docs/index.mdx)
- [Installation](./content/docs/installation.mdx)
- [Provider & setup](./content/docs/setup.mdx)
- [DataTable reference](./content/docs/datatable.mdx)
- [Bulk Actions](./content/docs/bulk-actions.mdx)
- [Configuration](./content/docs/configuration.mdx)
- [Columns](./content/docs/columns.mdx)
- [Actions](./content/docs/actions.mdx)
- [Server-side & Server Actions](./content/docs/server-actions.mdx)
- [URL state (Nuqs)](./content/docs/url-state.mdx)
- [Translations](./content/docs/translations.mdx)

## Example

See the **/example** app in this repo for a full UI integration setup: URL state (Nuqs), saved views, advanced filters, bulk edit, and local persisted demo data (`localStorage` + dataset reset).

For a server-driven implementation, follow [Server-side & Server Actions](./content/docs/server-actions.mdx).

## Registry maintenance (contributors)

Source of truth for the Shadcn registry is **src/components/ui/yayaw-table** (and custom files under `src/components/ui/custom`). The folder **registry/default/ui/yayaw-table** is generated; only edit files under `src/`.

After editing files in `src/components/ui/yayaw-table` or custom UI files:

```bash
bun run registry:sync
```

To regenerate the distributable registry JSON in `public/r`:

```bash
bun run registry:build
```

To generate the immutable registry snapshot for the current `package.json`
version:

```bash
bun run registry:release
```

Release notes and SemVer bumps are managed with Changesets. See
[Release workflow](./docs/RELEASES.md) before tagging a version.

## Development

```bash
git clone https://github.com/your-username/yayaw-table
cd yayaw-table
bun install
bun run dev
```

- **Format & lint**: `bun x ultracite fix`
- **Check**: `bun x ultracite check`
- **Tests**: `bun test src/components/ui/yayaw-table`

See [AGENTS.md](./AGENTS.md) for code standards and registry workflow.

## License

MIT
