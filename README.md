## YaYaw Table

Flexible, type-safe data table for React. One component, clean API, minimal boilerplate. Built on `@tanstack/react-table` with first-class TypeScript support.

### ✨ Features

- **Simple API**: One component to render a complete data table
- **Built-in UX**: Sorting, pagination, grouping, column visibility, bulk actions
- **Number & currency**: Right-aligned number columns with configurable format (thousands/decimal separators, prefix/suffix for currency, e.g. euros)
- **Type-safe**: Strong TypeScript types out of the box
- **Accessible**: Keyboard navigation and ARIA-friendly UI
- **SSR-friendly**: Works great with Next.js 15+
- **Powered by TanStack Table**: Excellent performance
- **Tailwind-ready**: Easy to style

### Installation (Shadcn Registry)

Prerequisites:

- A project already initialized with Shadcn UI
- `components.json` configured with `"aliases": { "ui": "@/components/ui" }`

Install YaYaw Table from the registry:

```bash
npx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
```

If your project has the `@yayaw` registry namespace configured:

```bash
npx shadcn@latest add @yayaw/yayaw-table
```

The CLI will copy the code to `components/ui/yayaw-table` and install required dependencies.

### Quick Start

```tsx
import { DataTable } from "@/components/ui/yayaw-table";

export const MyTable = () => <DataTable tableType="products" />;
```

Common props:

- `tableType`: your table configuration key
- `getTableConfig` / `getTableActions`: configuration and server actions resolver
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

### Registry Maintenance

After editing files in `src/components/ui/yayaw-table` (or custom files listed in `src/components/ui/custom`):

```bash
bun run registry:sync
```

To regenerate the distributable registry JSON in `public/r`:

```bash
bun run registry:build
```

### Contributing

```bash
git clone https://github.com/your-org/yayaw-table
cd yayaw-table
bun install
bun run dev
```

### License

MIT
