# YaYaw Table

Flexible, type-safe data tables for React and Vue 3, distributed as Shadcn-compatible registries.

This repository contains the component sources, generated registry artifacts, tests, and release tooling. It does not contain or deploy a documentation website. The public surfaces are:

- [React and Vue documentation](https://yayaw.app/en/docs/table)
- [Documentation française](https://yayaw.app/fr/docs/table)
- [Interactive React demo](https://yayaw.app/en/table/example)
- [Démo React interactive](https://yayaw.app/fr/table/example)
- [Interactive Vue demo](https://table.yayaw.app/vue-example/)
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

Both editions use TanStack Table 9.2.4 and require an ESM build targeting
ES2022 or newer. The Vue edition continues to require Vue `^3.5.0`; this
migration does not widen framework compatibility.

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

### Clear filters from either toolbar

Set `table.showClearFilters: true` in your table configuration to display an
icon at the far right of the toolbar. It clears column filters, advanced filters,
and global search, and returns to the first page. Sorting, grouping, column
layout, page size, and saved views are preserved. The flag defaults to `false`
and requires the toolbar to be visible. The icon stays available in both text
and icon action modes, including on mobile. Its tooltip and accessible label use
`filters.clear` from your translations. `showResetFilters` remains a supported
alias and now has the same behavior in React and Vue.

### Resize columns

Set `table.enableColumnResizing: true` to add accessible resize handles to data
columns. Drag with a pointer or use Left/Right Arrow, Home, and End while a
handle is focused. Double-click restores the configured width. Add
`enableResizing: false` to an individual column to keep it fixed. Resized widths
are included in saved views and shareable URLs in both React and Vue.

### Migrate from TanStack Table 8

Reinstall the registry so the generated `tanstack.ts` adapter and the TanStack
Table 9 dependency are updated together. Import table-bound TanStack types from
that local adapter when extending the copied components. TanStack 9 uses
`start`/`end` for its internal pinning state, while YaYaw's public saved-view and
URL contracts remain `left`/`right`; existing serialized views require no data
migration.

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
