"use client"

import { DataTable, TableProvider, defaultTranslations } from '../../index'
import { QueryClient } from '@tanstack/react-query'
import { products } from './data'
import { getTableConfig, getTableActions } from './table-config'
import { getFormConfig } from './form-config'
import { CustomTitle, CustomDescription } from './components'

// Create a query client
const queryClient = new QueryClient()

export default function ExamplePage() {
  return (
    <TableProvider
      tableId="products"
      translations={defaultTranslations}
      locale="en"
      getTableConfig={getTableConfig}
      getTableActions={getTableActions}
      getFormConfig={getFormConfig}
      TitleComponent={CustomTitle}
      DescriptionComponent={CustomDescription}
      queryClient={queryClient}
    >
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">   

          {/* Data Table */}
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-6">
              <DataTable 
                tableType="products"
                title="Products Management"
                description="Manage your product inventory with advanced filtering and actions"
                enableAdvancedFilters={true}
                data={products}
                columnTypeMapping={{
                  // Map table config types to filter types
                  name: 'text',
                  brand: 'text', 
                  category: 'option',  // tag -> option for dropdown
                  price: 'number',
                  status: 'option',    // tag -> option for dropdown  
                  createdAt: 'date',
                  isActive: 'option'   // boolean -> option for true/false
                }}
              />
            </div>
          </div>

          {/* Code Example */}
          <div className="mt-8 bg-card rounded-lg border border-border p-6">
            <h3 className="text-card-foreground mb-4">📋 Configuration Used</h3>
            <div className="bg-muted rounded-md p-4 overflow-x-auto">
              <pre className="text-sm text-muted-foreground">
{`// 1. Configuration via provider
const getTableConfig = (tableType: string) => {
  if (tableType === "products") {
    return {
      table: { 
        enableRowSelection: true,
        enableColumnFilters: true,
        enableSorting: true,
        manualFiltering: false,
        manualPagination: false,
        manualSorting: false
      },
      columns: {
        definitions: [
          { id: "name", type: "text", header: "Product Name" },
          { id: "brand", type: "text", header: "Brand" },
          { id: "category", type: "tag", header: "Category" },
          { id: "price", type: "number", header: "Price" },
          { id: "status", type: "tag", header: "Status" },
          { id: "createdAt", type: "date", header: "Created" },
          { id: "isActive", type: "boolean", header: "Active" }
        ]
      }
    }
  }
}

// 2. Advanced Filters Configuration
<DataTable 
  tableType="products"
  enableAdvancedFilters={true}
  data={products}
  columnTypeMapping={{
    name: 'text',
    brand: 'text', 
    category: 'option',  // tag -> option for dropdown
    price: 'number',
    status: 'option',    // tag -> option for dropdown  
    createdAt: 'date',
    isActive: 'option'   // boolean -> option for true/false
  }}
/>

// ✅ Now includes Advanced Filters with proper type mapping!`}
              </pre>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex justify-center gap-4">
            <a 
              href="/docs" 
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              📚 Read Documentation
            </a>
            <a 
              href="/" 
              className="inline-flex items-center px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
            >
              🏠 Back Home
            </a>
          </div>
        </div>
      </div>
    </TableProvider>
  )
} 