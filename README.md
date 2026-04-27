# YaYaw Table

Flexible, type-safe data table for React. One component, clean API, minimal boilerplate. Built on **TanStack Table** with first-class TypeScript support. Data and state can be driven by **Next.js Server Actions** and **Nuqs** (URL state).

## Features

- **Simple API** – One component to render a full data table; pass `getTableConfig` and `getTableActions` and you’re set
- **Server-first** – Built for Next.js 15 and 16 with Server Actions for list/create/update/delete and bulk operations
- **URL state** – Sort, filters, and pagination in the URL via [Nuqs](https://nuqs.io) (optional)
- **Built-in UX** – Sorting, pagination, grouping, column visibility, column reorder (drag-and-drop), global search
- **Filters** – Column filters and advanced filters panel; filter presets supported
- **Number & currency** – Right-aligned number columns with configurable format (thousands/decimal separators, prefix/suffix)
- **Column types** – Text, tag, number, boolean, date; extensible via `columnTypeMapping`
- **Bulk actions** – Edit, copy, export (CSV), delete; bulk edit with generated forms
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
npx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
```

To install a pinned release instead of the moving latest registry item:

```bash
npx shadcn@latest add https://table.yayaw.eu/r/v0.1.0/yayaw-table.json
```

If your project has the `@yayaw` registry namespace configured:

```bash
npx shadcn@latest add @yayaw/yayaw-table
```

The CLI copies the code to `components/ui/yayaw-table` (or your `ui` alias) and installs required dependencies.

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
- **enableAdvancedFilters** – Toggle advanced filters UI
- **columnTypeMapping** – Map backend data types to internal renderers

## Documentation

Docs live in this repo under `content/docs/`. Full documentation (when the site is built) is available there:

- [Getting started](./content/docs/index.mdx)
- [Installation](./content/docs/installation.mdx)
- [Provider & setup](./content/docs/setup.mdx)
- [DataTable reference](./content/docs/datatable.mdx)
- [Configuration](./content/docs/configuration.mdx)
- [Columns](./content/docs/columns.mdx)
- [Actions](./content/docs/actions.mdx)
- [Server-side & Server Actions](./content/docs/server-actions.mdx)
- [URL state (Nuqs)](./content/docs/url-state.mdx)
- [Translations](./content/docs/translations.mdx)

## Example

See the **/example** app in this repo for a full UI integration setup: URL state (Nuqs), advanced filters, bulk edit, and local persisted demo data (`localStorage` + dataset reset).

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
