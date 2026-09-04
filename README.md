# YaYaw Table

Flexible, type-safe data tables for React and Vue 3, distributed as Shadcn-compatible registries.

This repository contains the component sources, generated registry artifacts, tests, and release tooling. It does not contain or deploy a documentation website. The public surfaces are:

- [React and Vue documentation](https://yayaw.app/en/docs/table)
- [Documentation française](https://yayaw.app/fr/docs/table)
- [Interactive React demo](https://yayaw.app/en/table/example)
- [Démo React interactive](https://yayaw.app/fr/table/example)
- Static registry files under `https://table.yayaw.app/r/`, served by GitHub Pages

The registry host root is not an install target. Always use an explicit `/r/*.json` URL or the `@yayaw` namespace.

## Editions

- React: source of truth in `src/components/ui/yayaw-table`
- Vue 3: standalone package in `packages/yayaw-table-vue`
- Generated React registry: `registry/default/ui/yayaw-table`
- Published artifacts: `public/r`

## Install

React:

```bash
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
```

Vue 3:

```bash
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
```

Pinned React releases are available under `/r/vX.Y.Z/yayaw-table.json`. Projects with the registry namespace configured can also use:

```bash
npx shadcn@latest add @yayaw/yayaw-table
```

## React quick start

```tsx
import { DataTable } from "@/components/ui/yayaw-table";
import { getTableActions, getTableConfig } from "./table-config";

export function ProductsTable() {
  return (
    <DataTable
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      tableType="products"
      title="Products"
    />
  );
}
```

The React edition supports shared TanStack Query state, typed filters, URL state with Nuqs, saved views, table/Kanban/gallery modes, forms, inline editing, and bulk actions. It can use Next.js Server Actions, regular HTTP APIs, or any backend adapter that implements the action contracts.

### Clear filters from the React toolbar

Set `table.showResetFilters: true` in your table configuration to display an
icon at the far right of the toolbar. It clears column filters, advanced filters,
and global search, and returns to the first page. Sorting, grouping, column
layout, page size, and saved views are preserved. The flag defaults to `false`
and requires the toolbar to be visible. The icon stays available in both text
and icon action modes, including on mobile. Its tooltip and accessible label use
`filters.clear` from your translations.

## Development

```bash
bun install
bun install --cwd packages/yayaw-table-vue
bun run type-check
bun run test
bun run vue:test
bun run vue:build
bun run registry:pages
```

After editing React source files, run `bun run registry:sync`. To rebuild every public registry artifact and the GitHub Pages bundle, run `bun run registry:pages`.

Release notes and SemVer bumps use Changesets. See [the release workflow](./docs/RELEASES.md).

## License

MIT

See [React and Vue compatibility](docs/FRAMEWORK-PARITY.md) for shared action contracts, catalogue forms, bulk editing, and reset behavior.
