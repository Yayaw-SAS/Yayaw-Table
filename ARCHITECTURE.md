# YaYaw Table - Architecture

## 🏗️ Overview

YaYaw Table is a flexible data table component library that allows users to define their own table configurations rather than imposing predefined structures.

## 🎯 Core Philosophy

**User-Defined Configurations**: The library doesn't assume your data structure or table requirements. You provide both the configuration and data.

## 📦 Main Components

### 1. DataTable (Primary Component)
```tsx
<DataTable 
  tableType="products"
  config={myTableConfig}
  data={myData}
/>
```

**Props**:
- `config: TableConfig` - **Required** - Your table configuration
- `data: any[]` - **Required** - Your data array
- `tableType: string` - Identifier for the table type
- `onRowSelectionChange?` - Callback for row selection
- `loading?` - Loading state

### 2. Configuration Helper
```tsx
import { defineTableConfig } from "@/components/ui/yayaw-table";

const myTableConfig = defineTableConfig({
  id: "products",
  columns: {
    definitions: [
      { id: "name", type: "text", header: "Product Name" },
      { id: "price", type: "number", header: "Price" },
      { id: "status", type: "tag", header: "Status" }
    ],
    order: ["select", "name", "price", "status", "actions"],
    visible: ["select", "name", "price", "status", "actions"],
    mandatory: ["name"]
  },
  table: {
    defaultPageSize: 10,
    enableSorting: true,
    enablePagination: true
  },
  translations: {
    keys: { title: "My Products" },
    namespace: "products"
  }
})
```

## 🔧 Column Type System

The library supports these column types:

| Type | Purpose | Example |
|------|---------|---------|
| `text` | Plain text display | Names, descriptions |
| `number` | Numeric values | Prices, quantities |
| `tag` | Badge-style tags | Status, categories |
| `date` | Date formatting | Created, updated dates |
| `boolean` | True/false values | Active/inactive states |
| `code` | Code snippets | IDs, keys |
| `dynamicType` | Variable content | Mixed data types |

## 📂 Repository Structure

```text
yayaw-table/
├── src/
│   ├── components/ui/yayaw-table/       # Source of truth for the table block
│   ├── components/ui/custom/            # Shared custom UI files used by the block
│   └── lib/                             # Shared utilities
├── registry/
│   ├── default/ui/yayaw-table/          # Generated from src (do not edit by hand)
│   └── registry.json                    # Shadcn registry manifest
├── public/r/                            # Built registry artifacts served by docs site
└── scripts/build-registry.mjs           # Sync/generate registry files
```

## 🚀 Usage Patterns

### Basic Usage
```tsx
import { DataTable, defineTableConfig } from "@/components/ui/yayaw-table";

// 1. Define your configuration
const tableConfig = defineTableConfig({
  id: "users",
  columns: {
    definitions: [
      { id: "name", type: "text", header: "Name" },
      { id: "email", type: "text", header: "Email" },
      { id: "role", type: "tag", header: "Role" }
    ],
    order: ["select", "name", "email", "role", "actions"],
    visible: ["select", "name", "email", "role", "actions"]
  },
  table: { defaultPageSize: 10 }
})

// 2. Use with your data
<DataTable 
  tableType="users"
  config={tableConfig}
  data={userData}
/>
```

### Multiple Table Types
```tsx
// Define different configurations for different data
const productsConfig = defineTableConfig({ /* products setup */ })
const usersConfig = defineTableConfig({ /* users setup */ })

// Use different tables in your app
<DataTable tableType="products" config={productsConfig} data={products} />
<DataTable tableType="users" config={usersConfig} data={users} />
```

## 🎨 Styling & Customization

- **Tailwind CSS** based styling
- **Radix UI** components for accessibility
- **Customizable themes** through CSS variables
- **Dark mode** support ready

## 📱 Responsive Design

- Mobile-first responsive tables
- Horizontal scrolling on small screens
- Adaptive column sizing
- Touch-friendly interactions

## 🔄 State Management

**Built-in State** (default):
- React hooks for basic table state
- No external dependencies

**Advanced State** (optional):
- Jotai for complex state management
- React Query for server state
- Available as optional peer dependencies

## 🔌 Extensibility

### Column Generators (Upcoming)
```tsx
// Custom column types will be supported
createCustomColumn({
  type: "avatar",
  render: (value) => <Avatar src={value} />
})
```

### Form Integration (Upcoming)
```tsx
// Connect forms for CRUD operations
defineTableConfig({
  form: {
    createFormType: "product-form",
    editFormType: "product-form"
  }
})
```

## 🚦 Dependency Strategy

**Required Dependencies**:
- React
- @tanstack/react-table
- Radix UI components

**Optional Dependencies**:
- jotai (advanced state)
- @tanstack/react-query (server state)
- @dnd-kit/* (drag and drop)
- motion/react (animations)

## ✅ Benefits

**🎯 No Assumptions**: Library doesn't impose data structures
**🔧 Full Control**: You define table behavior completely
**📦 Smaller Bundle**: No unused configurations included
**🚀 Flexible**: Create any table type you need
**🏗️ Scalable**: Add new tables without library updates

## 🔄 Migration Path

If migrating from other table libraries:

1. **Identify your data structure**
2. **Create table configuration** with `defineTableConfig()`
3. **Pass configuration and data** to `<DataTable>`
4. **Customize column types** as needed

## 🧪 Testing

See [TESTING.md](./TESTING.md) for development setup and testing instructions.

## 🎉 Next Steps

1. **Implement Column Generators** - Real column renderers
2. **Advanced Toolbar** - Search, filters, actions
3. **Form Integration** - CRUD operations
4. **Server Integration** - API patterns
5. **Advanced Features** - Export, bulk actions, etc. 
