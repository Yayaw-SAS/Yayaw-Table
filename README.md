## YaYaw Table

Flexible, type-safe data table for React. One component, clean API, minimal boilerplate. Built on `@tanstack/react-table` with first-class TypeScript support.

### ✨ Features

- **Simple API**: One component to render a complete data table
- **Built-in UX**: Sorting, pagination, grouping, column visibility, bulk actions
- **Type-safe**: Strong TypeScript types out of the box
- **Accessible**: Keyboard navigation and ARIA-friendly UI
- **SSR-friendly**: Works great with Next.js 15
- **Powered by TanStack Table**: Excellent performance
- **Tailwind-ready**: Easy to style

### Installation

```bash
npm install yayaw-table
# or
bun add yayaw-table
# or
pnpm add yayaw-table
```

Peer dependencies:

- `react` (^18 or ^19)
- `react-dom` (^18 or ^19)
- `@tanstack/react-table` (^8)
- `@tanstack/react-query` (^5)
- `nuqs` (^2)
- `jotai` (^2)
- `jotai-family` (^1)

### Quick Start

```tsx
import { DataTable } from 'yayaw-table';

export const MyTable = () => (
  <DataTable tableType="products" />
);
```

Common props:

- `tableType`: your table configuration key
- `loadingOverlay`: custom loading UI
- `onRowSelectionChange`, `onBulkDelete`, `onBulkEdit`, `onBulkCopy`
- `enableAdvancedFilters`: toggle advanced filters UI
- `columnTypeMapping`: map backend data types to internal renderers

### Documentation

- [Getting Started](./content/docs/index.mdx)
- [Installation](./content/docs/installation.mdx)
- [DataTable Reference](./content/docs/datatable.mdx)
- [Configuration](./content/docs/configuration.mdx)
- [Columns](./content/docs/columns.mdx)
- [Actions](./content/docs/actions.mdx)
- [Translations](./content/docs/translations.mdx)

### Example

- Open the example page at `/example` when running the dev server
- Source: `./app/example/page.tsx`

### Acknowledgements

Massive thanks to the teams behind:

- [TanStack Table](https://tanstack.com/table)
- [TanStack Query](https://tanstack.com/query)
- [shadcn/ui](https://ui.shadcn.com)
- [Nuqs](https://nuqs.io)
- [Jotai](https://jotai.org)
- [dnd-kit](https://dndkit.com)
- [Floating UI](https://floating-ui.com)
- [Base UI](https://base-ui.com)

### Contributing

```bash
git clone https://github.com/your-org/yayaw-table
cd yayaw-table
bun install
bun run dev
```

### License

MIT
