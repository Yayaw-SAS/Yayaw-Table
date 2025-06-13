import { productActions } from './data'

// Configuration du tableau
export const getTableConfig = (tableType: string): any => {
  if (tableType === "products") {
    return {
      table: {
        enableRowSelection: true,
        enableColumnFilters: true,
        enableSorting: true,
        enableColumnDragDropByDefault: false,
        manualFiltering: false,
        manualPagination: false,
        manualSorting: false
      },
      columns: {
        definitions: [
          { id: "name", type: "text", header: "Product Name", enableSorting: true, enableColumnFilter: true },
          { id: "brand", type: "text", header: "Brand", enableSorting: true, enableColumnFilter: true },
          { id: "category", type: "tag", header: "Category", enableSorting: true, enableColumnFilter: true, options: ["Laptops", "Phones", "Tablets", "Accessories"] },
          { id: "price", type: "number", header: "Price", enableSorting: true, enableColumnFilter: true },
          { id: "status", type: "tag", header: "Status", enableSorting: true, enableColumnFilter: true, options: ["In Stock", "Low Stock", "Out of Stock"] },
          { id: "createdAt", type: "date", header: "Created", enableSorting: true, enableColumnFilter: true },
          { id: "isActive", type: "boolean", header: "Active", enableSorting: true, enableColumnFilter: true, options: [{ value: true, label: "Active" }, { value: false, label: "Inactive" }] }
        ],
        order: ["select", "name", "brand", "category", "price", "status", "createdAt", "isActive", "actions"],
        visible: ["select", "name", "brand", "category", "price", "status", "createdAt", "isActive", "actions"],
        mandatory: ["name", "price"]
      },
      translations: {
        namespace: "products",
        keys: {
          "Product Name": "Product Name",
          "Brand": "Brand", 
          "Category": "Category",
          "Price": "Price",
          "Status": "Status",
          "Created": "Created",
          "Active": "Active",
          "title": "Products Table",
          "description": "Manage your products"
        }
      }
    }
  }
  return undefined
}

// Configuration des actions du tableau
export const getTableActions = (tableType: string) => {
  if (tableType === "products") {
    return productActions
  }
  return undefined
} 