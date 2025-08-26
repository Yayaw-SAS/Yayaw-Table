'use client';

import { QueryClient } from '@tanstack/react-query';
import {
  DataTable,
  defaultTranslations,
  TableProvider,
  ThemeToggle,
} from '../../index';
import { CustomDescription, CustomTitle } from './components';
import { getFormConfig } from './form-config';
import { getTableActions, getTableConfig } from './table-config';

// Create a query client
const queryClient = new QueryClient();

export default function ExamplePage() {
  return (
    <TableProvider
      DescriptionComponent={CustomDescription}
      getFormConfig={getFormConfig}
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      locale="en"
      queryClient={queryClient}
      TitleComponent={CustomTitle}
      tableId="products"
      translations={defaultTranslations}
    >
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header with Theme Toggle */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-3xl text-foreground tracking-tight">
                YaYaw Table Demo
              </h1>
              <p className="mt-2 text-muted-foreground">
                Experience the power of advanced data tables with theme support
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle variant="switch" />
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="p-6">
              <DataTable
                columnTypeMapping={{
                  // Map table config types to filter types
                  name: 'text',
                  brand: 'text',
                  category: 'option', // tag -> option for dropdown
                  price: 'number',
                  status: 'option', // tag -> option for dropdown
                  createdAt: 'date',
                  isActive: 'option', // boolean -> option for true/false
                }}
                description="Production-ready table with server-side pagination, filtering, and sorting"
                enableAdvancedFilters={true}
                tableType="products"
                title="Products Management"
              />
            </div>
          </div>

          {/* Code Example */}
          <div className="mt-8 rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 text-card-foreground">📋 Configuration Used</h3>
            <div className="overflow-x-auto rounded-md bg-muted p-4">
              <pre className="text-muted-foreground text-sm">
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

// 2. Production Table with Real API
<DataTable 
  tableType="products"
  enableAdvancedFilters={true}
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

// ✅ Server-side API with pagination, filtering, and sorting!
// 🎨 Try switching themes with the toggle in the top-right!`}
              </pre>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex justify-center gap-4">
            <a
              className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              href="/docs"
            >
              📚 Read Documentation
            </a>
            <a
              className="inline-flex items-center rounded-lg bg-secondary px-6 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              href="/"
            >
              🏠 Back Home
            </a>
          </div>
        </div>
      </div>
    </TableProvider>
  );
}
