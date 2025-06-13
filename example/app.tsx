import React from 'react'
import { createRoot } from 'react-dom/client'
import { 
  DataTable,
  TableProvider, 
  defaultTranslations
} from '../index'

// Note: Current DataTable API uses tableType to get configuration from internal catalogue
// The defineTableConfig configurations below are kept for reference but not used in this example

/* Example of table configurations (not currently used by DataTable):
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
      // ... other column definitions
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
*/

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
    <TableProvider 
      tableId="example"
      translations={defaultTranslations}
      locale="en"
      getTableConfig={(tableType) => undefined}
    >
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📦 YaYaw Table - Simple Data Tables
            </h1>
            <p className="text-gray-600">
              This shows how to use DataTable with your own data using a simple API
            </p>
          </div>

          {/* Product catalogue table example */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">🛒 Product Catalogue Table</h2>
            <p className="text-gray-600">
              Simple DataTable with product data using tableType "catalogue"
            </p>
            
            <DataTable 
              tableType="catalogue"
              data={catalogueData}
            />
          </div>

          {/* Users management table example */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">👥 Users Management Table</h2>
            <p className="text-gray-600">
              DataTable with users data using tableType "users"
            </p>
            
            <DataTable 
              tableType="users"
              data={usersData}
            />
          </div>

          {/* Code Examples */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">📋 How to Use (Current API)</h3>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium">1. Import the DataTable component:</h4>
                <pre className="bg-white p-3 rounded border mt-2 overflow-x-auto">
{`import { DataTable, TableProvider, defaultTranslations } from 'yayaw-table'`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium">2. Use the DataTable with your data:</h4>
                <pre className="bg-white p-3 rounded border mt-2 overflow-x-auto">
{`<DataTable 
  tableType="products"
  data={myData}
  title="My Products"
  description="Manage your product inventory"
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
            <h3 className="font-medium text-green-900 mb-2">✅ Benefits of YaYaw Table</h3>
            <div className="text-sm text-green-800 space-y-1">
              <p>🎯 <strong>Simple API:</strong> Just provide your data and tableType</p>
              <p>🔧 <strong>Automatic features:</strong> Sorting, filtering, pagination out of the box</p>
              <p>📦 <strong>Optimized bundle:</strong> Only loads what you need</p>
              <p>🚀 <strong>Flexible:</strong> Works with any data structure</p>
              <p>🏗️ <strong>Scalable:</strong> Add new table types easily</p>
            </div>
          </div>
        </div>
      </div>
    </TableProvider>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />) 