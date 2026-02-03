"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
// Row type is not used directly in this file
import { ThemeToggle } from "../../src/components/ui-custom/theme-toggle";
import { DataTable } from "../../src/data-table/components/data-table";
import { useBulkEdit } from "../../src/data-table/hooks/use-bulk-edit";
import { CustomDescription, CustomTitle } from "./components";
import { getFormConfig } from "./setup/form-config";
import { getTableActions, getTableConfig } from "./setup/table-config";

// Create a query client
const queryClient = new QueryClient();

function BulkActionsSection() {
  const actions = getTableActions("products") as
    | {
        bulkDelete?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        bulkCopy?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
      }
    | undefined;

  const handleBulkDelete = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!actions?.bulkDelete) {
      toast.error("Delete action not available");
      return;
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await actions.bulkDelete(ids);

      if (result.success) {
        toast.success(`✅ Deleted ${rows.length} products successfully!`);
      } else {
        toast.error(result.error || "Failed to delete products");
      }
    } catch (_error) {
      toast.error("❌ Failed to delete products");
    }
  };

  const handleBulkCopy = async (
    rows: Array<{ original: { id?: unknown } }>
  ) => {
    if (!actions?.bulkCopy) {
      toast.error("Copy action not available");
      return;
    }

    try {
      const ids = rows.map((row) => String(row.original.id ?? ""));
      const result = await actions.bulkCopy(ids);

      if (result.success && result.data) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.data);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = result.data;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        }
      } else {
        toast.error(result.error || "Failed to copy products");
      }
    } catch (_error) {
      toast.error("❌ Failed to copy products to clipboard");
    }
  };

  const bulkEdit = useBulkEdit({
    tableId: "products",
    formType: "products-bulk",
    onSuccess: () => {
      /* intentional no-op */
    },
    onUpdate: async () => true,
  });

  return (
    <DataTable
      className="w-full"
      columnTypeMapping={{
        name: "text",
        brand: "text",
        category: "option",
        price: "number",
        status: "option",
        createdAt: "date",
        isActive: "option",
      }}
      DescriptionComponent={CustomDescription}
      description="Production-ready table with server-side pagination, filtering, and sorting. Select multiple rows to see bulk actions!"
      enableAdvancedFilters={true}
      enableToolbar={true}
      getFormConfig={getFormConfig}
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      loadingOverlay={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Loading products…
        </div>
      }
      locale="en"
      onBulkCopy={handleBulkCopy}
      onBulkDelete={handleBulkDelete}
      onBulkEdit={(rows) => bulkEdit.openBulkEdit(rows as never)}
      onRowSelectionChange={undefined}
      queryClient={queryClient}
      TitleComponent={CustomTitle}
      tableType="products"
      title="Products Management"
    />
  );
}

export default function ExamplePage() {
  return (
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
              <ThemeToggle variant="switch" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6">
            <QueryClientProvider client={queryClient}>
              <BulkActionsSection />
            </QueryClientProvider>
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
      </div>
    </div>
  );
}
