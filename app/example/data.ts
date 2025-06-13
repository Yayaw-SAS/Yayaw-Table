import { type Product, type CreateProductData, type UpdateProductData } from './types'

// Sample data for products - Mutable array for testing CRUD operations
export const products: Product[] = [
  {
    id: "1",
    name: "MacBook Pro 16\"",
    price: 2499,
    status: "In Stock",
    category: "Laptops",
    brand: "Apple",
    createdAt: new Date("2024-01-15"),
    isActive: true
  },
  {
    id: "2", 
    name: "iPhone 15 Pro",
    price: 999,
    status: "Low Stock",
    category: "Phones",
    brand: "Apple",
    createdAt: new Date("2024-02-10"),
    isActive: true
  },
  {
    id: "3",
    name: "Samsung Galaxy S24",
    price: 899,
    status: "Out of Stock",
    category: "Phones", 
    brand: "Samsung",
    createdAt: new Date("2024-01-20"),
    isActive: false
  },
  {
    id: "4",
    name: "Dell XPS 13",
    price: 1299,
    status: "In Stock",
    category: "Laptops",
    brand: "Dell", 
    createdAt: new Date("2024-03-01"),
    isActive: true
  },
  {
    id: "5",
    name: "iPad Air",
    price: 599,
    status: "In Stock",
    category: "Tablets",
    brand: "Apple",
    createdAt: new Date("2024-02-15"),
    isActive: true
  },
  {
    id: "6",
    name: "MacBook Air M3",
    price: 1299,
    status: "In Stock",
    category: "Laptops",
    brand: "Apple",
    createdAt: new Date("2024-03-10"),
    isActive: true
  },
  {
    id: "7",
    name: "Samsung Galaxy Tab S9",
    price: 799,
    status: "Low Stock",
    category: "Tablets",
    brand: "Samsung",
    createdAt: new Date("2024-02-28"),
    isActive: true
  },
  {
    id: "8",
    name: "AirPods Pro",
    price: 249,
    status: "In Stock",
    category: "Accessories",
    brand: "Apple",
    createdAt: new Date("2024-03-05"),
    isActive: true
  },
  {
    id: "9",
    name: "Google Pixel 8",
    price: 699,
    status: "Out of Stock",
    category: "Phones",
    brand: "Google",
    createdAt: new Date("2024-01-25"),
    isActive: false
  },
  {
    id: "10",
    name: "ThinkPad X1 Carbon",
    price: 1899,
    status: "In Stock",
    category: "Laptops",
    brand: "Lenovo",
    createdAt: new Date("2024-02-20"),
    isActive: true
  },
  {
    id: "11",
    name: "Surface Pro 9",
    price: 1199,
    status: "Low Stock",
    category: "Tablets",
    brand: "Microsoft",
    createdAt: new Date("2024-01-30"),
    isActive: true
  },
  {
    id: "12",
    name: "Samsung Galaxy Buds",
    price: 149,
    status: "In Stock",
    category: "Accessories",
    brand: "Samsung",
    createdAt: new Date("2024-03-12"),
    isActive: true
  },
  {
    id: "13",
    name: "HP Spectre x360",
    price: 1599,
    status: "Out of Stock",
    category: "Laptops",
    brand: "HP",
    createdAt: new Date("2024-02-05"),
    isActive: false
  },
  {
    id: "14",
    name: "OnePlus 12",
    price: 799,
    status: "In Stock",
    category: "Phones",
    brand: "OnePlus",
    createdAt: new Date("2024-03-08"),
    isActive: true
  },
  {
    id: "15",
    name: "Magic Mouse",
    price: 99,
    status: "In Stock",
    category: "Accessories",
    brand: "Apple",
    createdAt: new Date("2024-02-25"),
    isActive: true
  }
]

// Server actions simulées - Ajustées pour correspondre aux types attendus
export const productActions = {
  list: async (params: {
    page?: number
    limit?: number
    filters?: Record<string, unknown> | Array<{ id: string; value: unknown }>
    orderBy?: Record<string, 'asc' | 'desc'>
    search?: string
  }) => {
    console.log("🚀 Server action 'list' called with params:", params)
    
    const { 
      page = 1, 
      limit = 10, 
      filters = {}, 
      orderBy = {}, 
      search = "" 
    } = params
    
    // Convert page to 0-based index (server sends 1-based)
    const pageIndex = Math.max(0, page - 1)
    const pageSize = limit
    
    // Apply search filter
    let filteredProducts = search 
      ? products.filter(product => 
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.brand.toLowerCase().includes(search.toLowerCase()) ||
          product.category.toLowerCase().includes(search.toLowerCase())
        )
      : [...products]
    
    // Apply column filters - handle both array and object formats
    if (filters) {
      if (Array.isArray(filters)) {
        // Handle array format: [{ id: 'name', value: 'iPhone' }]
        filters.forEach((filter) => {
          if (filter.value && filter.value !== '') {
            filteredProducts = filteredProducts.filter(product => {
              const value = product[filter.id as keyof Product]
              if (typeof value === 'string') {
                return value.toLowerCase().includes(String(filter.value).toLowerCase())
              }
              return value === filter.value
            })
          }
        })
      } else {
        // Handle object format: { name: 'iPhone', status: 'In Stock' }
        Object.entries(filters).forEach(([filterId, filterValue]) => {
          if (filterValue && filterValue !== '') {
            filteredProducts = filteredProducts.filter(product => {
              const value = product[filterId as keyof Product]
              if (typeof value === 'string') {
                return value.toLowerCase().includes(String(filterValue).toLowerCase())
              }
              return value === filterValue
            })
          }
        })
      }
    }
    
    // Apply sorting from orderBy object
    if (orderBy && Object.keys(orderBy).length > 0) {
      const [sortField, sortDirection] = Object.entries(orderBy)[0]
      filteredProducts.sort((a, b) => {
        const aVal = a[sortField as keyof Product]
        const bVal = b[sortField as keyof Product]
        
        if (sortDirection === 'desc') {
          return aVal < bVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
    }
    
    // Apply pagination
    const startIndex = pageIndex * pageSize
    const endIndex = startIndex + pageSize
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex)
    
    const result = { 
      data: paginatedProducts, 
      meta: { 
        pageCount: Math.ceil(filteredProducts.length / pageSize), 
        totalCount: filteredProducts.length 
      } 
    }
    
    console.log("🎯 Server action 'list' returning:", result)
    return result
  },

  create: async (data: Record<string, unknown>): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      console.log("🚀 Server action 'create' called with data:", data)
      
      // Generate a new ID
      const newId = Math.max(...products.map(p => parseInt(p.id))) + 1
      const newProduct: Product = {
        id: newId.toString(),
        name: (data.name as string) || "",
        price: (data.price as number) || 0,
        status: (data.status as Product['status']) || "In Stock",
        category: (data.category as string) || "",
        brand: (data.brand as string) || "",
        isActive: (data.isActive as boolean) ?? true,
        createdAt: new Date()
      }
      
      // Add to products array (in real app, this would be a database operation)
      products.push(newProduct)
      
      console.log("🎯 Server action 'create' returning:", newProduct)
      return { success: true, data: newProduct }
    } catch (error) {
      console.error("❌ Server action 'create' error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to create product" 
      }
    }
  },

  update: async (id: string, data: Record<string, unknown>): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      console.log("🚀 Server action 'update' called with id:", id, "data:", data)
      
      // Find the product to update
      const productIndex = products.findIndex(p => p.id === id)
      if (productIndex === -1) {
        throw new Error(`Product with id ${id} not found`)
      }
      
      // Update the product, ensuring all required fields are present
      const updatedProduct: Product = {
        ...products[productIndex],
        name: (data.name as string) ?? products[productIndex].name,
        price: (data.price as number) ?? products[productIndex].price,
        status: (data.status as Product['status']) ?? products[productIndex].status,
        category: (data.category as string) ?? products[productIndex].category,
        brand: (data.brand as string) ?? products[productIndex].brand,
        isActive: (data.isActive as boolean) ?? products[productIndex].isActive,
        id, // Keep the original ID
      }
      
      // Update in products array (in real app, this would be a database operation)
      products[productIndex] = updatedProduct
      
      console.log("🎯 Server action 'update' returning:", updatedProduct)
      return { success: true, data: updatedProduct }
    } catch (error) {
      console.error("❌ Server action 'update' error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update product" 
      }
    }
  },

  delete: async (id: string): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      console.log("🚀 Server action 'delete' called with id:", id)
      
      // Find the product to delete
      const productIndex = products.findIndex(p => p.id === id)
      if (productIndex === -1) {
        throw new Error(`Product with id ${id} not found`)
      }
      
      // Remove from products array (in real app, this would be a database operation)
      const deletedProduct = products.splice(productIndex, 1)[0]
      
      console.log("🎯 Server action 'delete' returning:", deletedProduct)
      return { success: true, data: deletedProduct }
    } catch (error) {
      console.error("❌ Server action 'delete' error:", error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to delete product" 
      }
    }
  }
} 