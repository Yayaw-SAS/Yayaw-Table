import React from 'react'
import { createRoot } from 'react-dom/client'
import { 
  DataTable,
  defineTableConfig,
  TranslationsProvider, 
  defaultTranslations,
  type TableConfig
} from '../index'

// Example: User creates their own table configurations
const catalogueTableConfig = defineTableConfig({
  id: "catalogue",
  icon: "Package",
  columns: {
    definitions: [
      {
        id: "name",
        type: "text",
        header: "Product Name",
        enableSorting: true,
        size: 200
      },
      {
        id: "category", 
        type: "tag",
        header: "Category",
        enableSorting: true,
        size: 150
      },
      {
        id: "price",
        type: "number", 
        header: "Price",
        enableSorting: true,
        size: 120
      },
      {
        id: "stock",
        type: "number",
        header: "Stock",
        enableSorting: true,
        size: 100
      },
      {
        id: "status",
        type: "tag",
        header: "Status", 
        enableSorting: true,
        size: 120
      },
      {
        id: "lastUpdated",
        type: "date",
        header: "Last Updated",
        enableSorting: true,
        size: 150
      }
    ],
    mandatory: ["name"],
    order: ["select", "name", "category", "price", "stock", "status", "lastUpdated", "actions"],
    visible: ["select", "name", "category", "price", "stock", "status", "lastUpdated", "actions"],
    sort: [{ id: "name", desc: false }]
  },
  table: {
    defaultPageSize: 10,
    enableColumnDragDropByDefault: true,
    enableColumnFilters: true,
    enableMultiRowSelection: true,
    enablePagination: true,
    enableRowSelection: true,
    enableSorting: true,
    manualFiltering: false,
    manualPagination: false,
    manualSorting: false,
    pageSizeOptions: [5, 10, 20, 50, 100]
  },
  translations: {
    keys: {
      title: "Product Catalogue",
      description: "Manage your product inventory"
    },
    namespace: "catalogue"
  }
})

const usersTableConfig = defineTableConfig({
  id: "users",
  icon: "Users",
  columns: {
    definitions: [
      {
        id: "name",
        type: "text", 
        header: "Full Name",
        enableSorting: true,
        size: 200
      },
      {
        id: "email",
        type: "text",
        header: "Email Address", 
        enableSorting: true,
        size: 250
      },
      {
        id: "role",
        type: "tag",
        header: "Role",
        enableSorting: true,
        size: 120
      },
      {
        id: "status",
        type: "tag", 
        header: "Status",
        enableSorting: true,
        size: 120
      },
      {
        id: "lastLogin",
        type: "date",
        header: "Last Login",
        enableSorting: true,
        size: 150
      }
    ],
    mandatory: ["name", "email"],
    order: ["select", "name", "email", "role", "status", "lastLogin", "actions"],
    visible: ["select", "name", "email", "role", "status", "lastLogin", "actions"]
  },
  table: {
    defaultPageSize: 5,
    enableColumnFilters: true,
    enablePagination: true,
    enableRowSelection: true,
    enableSorting: true
  },
  translations: {
    keys: {
      title: "User Management",
      description: "Manage system users and permissions"
    },
    namespace: "users"
  }
})

// Example data that matches the table configurations
const catalogueData = [
  {
    id: '1',
    name: 'MacBook Pro 16"',
    category: 'Electronics',
    price: 2499,
    stock: 12,
    status: 'active',
    lastUpdated: '2024-01-15T10:00:00Z'
  },
  {
    id: '2', 
    name: 'iPhone 15 Pro',
    category: 'Electronics',
    price: 999,
    stock: 25,
    status: 'active',
    lastUpdated: '2024-01-14T15:30:00Z'
  },
  {
    id: '3',
    name: 'AirPods Pro',
    category: 'Audio',
    price: 249,
    stock: 0,
    status: 'discontinued',
    lastUpdated: '2024-01-10T08:45:00Z'
  },
  {
    id: '4',
    name: 'iPad Air', 
    category: 'Electronics',
    price: 599,
    stock: 18,
    status: 'active',
    lastUpdated: '2024-01-16T12:15:00Z'
  }
]

const usersData = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@company.com', 
    role: 'admin',
    status: 'active',
    lastLogin: '2024-01-15T14:30:00Z'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@company.com',
    role: 'user', 
    status: 'active', 
    lastLogin: '2024-01-14T09:15:00Z'
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@company.com',
    role: 'moderator',
    status: 'inactive',
    lastLogin: '2024-01-10T16:45:00Z'
  }
]

function App() {
  return (
    <TranslationsProvider translations={defaultTranslations}>
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📦 YaYaw Table - User-Defined Configurations
            </h1>
            <p className="text-gray-600">
              This shows how users create their own table configurations and provide their own data
            </p>
          </div>

          {/* User-provided table configuration example */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">🛒 Product Catalogue Table</h2>
            <p className="text-gray-600">
              User provides both configuration and data to the DataTable
            </p>
            
            <DataTable 
              tableType="catalogue"
              config={catalogueTableConfig}
              data={catalogueData}
            />
          </div>

          {/* Another example with different configuration */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">👥 Users Management Table</h2>
            <p className="text-gray-600">
              Different configuration with different data structure
            </p>
            
            <DataTable 
              tableType="users"
              config={usersTableConfig}
              data={usersData}
            />
          </div>

          {/* Code Examples */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">📋 How to Use (New API)</h3>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium">1. Create your table configuration:</h4>
                <pre className="bg-white p-3 rounded border mt-2 overflow-x-auto">
{`import { defineTableConfig } from 'yayaw-table'

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
})`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium">2. Use the DataTable with your config and data:</h4>
                <pre className="bg-white p-3 rounded border mt-2 overflow-x-auto">
{`<DataTable 
  tableType="products"
  config={myTableConfig}
  data={myData}
/>`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium">3. Available column types:</h4>
                <div className="bg-white p-3 rounded border mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><code>text</code> - Plain text columns</div>
                    <div><code>number</code> - Numeric values</div>
                    <div><code>tag</code> - Badge-style tags</div>
                    <div><code>date</code> - Date formatting</div>
                    <div><code>boolean</code> - True/false values</div>
                    <div><code>code</code> - Code snippets</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">✅ Benefits of User-Defined Configurations</h3>
            <div className="text-sm text-green-800 space-y-1">
              <p>🎯 <strong>No built-in assumptions:</strong> Library doesn't assume your data structure</p>
              <p>🔧 <strong>Full control:</strong> You define exactly how your tables work</p>
              <p>📦 <strong>Smaller bundle:</strong> No unused table configurations in the library</p>
              <p>🚀 <strong>Flexible:</strong> Create any table configuration you need</p>
              <p>🏗️ <strong>Scalable:</strong> Add new table types without updating the library</p>
            </div>
          </div>
        </div>
      </div>
    </TranslationsProvider>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />) 