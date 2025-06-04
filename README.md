# 📦 YaYaw Table

A flexible, powerful data table component library for React that lets you **define your own table configurations** instead of imposing predefined structures.

**No assumptions, full control.** Built on @tanstack/react-table with TypeScript.

## ✨ Features

- 🎛️ **User-Defined Configurations**: You define the table structure, not the library
- 🏗️ **7 Column Types**: text, number, tag, date, boolean, code, dynamic  
- 🚀 **Built on TanStack**: Powered by @tanstack/react-table for performance
- 📱 **Mobile Responsive**: Works great on all screen sizes
- 🎨 **Tailwind CSS v4**: Beautiful styling with latest features
- ⚡ **TypeScript**: Full type safety and excellent DX

## 🚀 Quick Start

1. **Install the library:**
```bash
bun add yayaw-table
# or
npm install yayaw-table
```

2. **Define your table configuration:**
```tsx
import { DataTable, defineTableConfig } from 'yayaw-table'

const productConfig = defineTableConfig({
  id: "products",
  columns: {
    definitions: [
      { id: "name", type: "text", header: "Product Name" },
      { id: "price", type: "number", header: "Price" },
      { id: "status", type: "tag", header: "Status" }
    ],
    order: ["select", "name", "price", "status", "actions"],
    visible: ["select", "name", "price", "status", "actions"]
  },
  table: { defaultPageSize: 10 }
})
```

3. **Use with your data:**
```tsx
<DataTable 
  tableType="products"
  config={productConfig}
  data={products}
/>
```

## 📱 Unified Development Experience

The project is now fully unified with everything in the root:

```bash
# Start the Next.js app (homepage + docs + examples)
bun run dev
```

This serves:
- **Homepage** (`/`) - Overview and quick start
- **Documentation** (`/docs`) - Complete API reference with Fumadocs
- **Live Examples** (`/example`) - Interactive playground (coming soon)

## 🏗️ Development

```bash
# Install dependencies
bun install

# Start the unified Next.js app
bun run dev

# Build the library (one-time)
bun run build

# Build the library (watch mode for development)
bun run build:watch

# Build the app for production
bun run build:app

# Start production app
bun run start
```

**Development Workflow:**
- **Full-stack development**: `bun run dev` → All-in-one Next.js app
- **Library development**: `bun run build:watch` (in separate terminal)

## 📁 Unified Project Structure

```
yayaw-table/
├── src/                    # Library source code
│   ├── data-table/        # Core DataTable components
│   ├── columns/           # Column type definitions
│   └── index.ts           # Public API
├── app/                   # Next.js App Router
│   ├── page.tsx          # Homepage
│   ├── docs/             # Documentation routes
│   ├── example/          # Live examples
│   └── source.ts         # Fumadocs source
├── content/              # MDX documentation content
│   └── docs/             # Documentation files
├── dist/                 # Built library output
├── .source/              # Generated Fumadocs source
├── tailwind.config.ts    # TailwindCSS v4 config
├── next.config.mjs       # Next.js configuration
└── package.json          # Unified dependencies
```

## 🎯 Architecture Benefits

### **Before**: 3 Separate Projects
- ❌ Library build watcher
- ❌ Docs app on port 3002  
- ❌ Example app on port 3001

### **After**: Unified Monolith
- ✅ **One command**: `bun run dev`
- ✅ **One codebase**: Everything in root
- ✅ **One deployment**: Library + docs + examples
- ✅ **TailwindCSS v4**: Latest features
- ✅ **TypeScript**: Shared types and config

## 🎯 Philosophy

YaYaw Table is built on the principle that **users should define their own data structures**, not adapt to predefined ones. Unlike traditional table libraries that force you to fit your data into their schemas, YaYaw Table provides the tools and flexibility for you to create exactly what you need.

## 📚 Key Concepts

### User-Defined Configurations
- Create configurations with `defineTableConfig()`
- Define your columns, types, and behavior
- No built-in assumptions about your data

### Column Types
- **text**: Simple text display and editing
- **number**: Numeric values with formatting
- **tag**: Colored tags/badges for status, categories
- **date**: Date formatting and time-relative display  
- **boolean**: Checkbox or toggle display
- **code**: Syntax-highlighted code blocks
- **dynamic**: Runtime-determined column types

### Flexible Architecture
- Peer dependencies model - bring your own versions
- Optional integrations (jotai, react-query, dnd-kit, etc.)
- TypeScript-first with full type safety

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ by [Yannis](https://github.com/your-username)
