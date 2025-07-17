import type { Product } from './types';

const DEBUG = process.env.NODE_ENV === 'development';
// Sample data for products - Mutable array for testing CRUD operations
export const products: Product[] = [
  {
    id: '1',
    name: 'MacBook Pro 16"',
    price: 2499,
    status: 'In Stock',
    category: 'Laptops',
    brand: 'Apple',
    createdAt: new Date('2024-01-15'),
    isActive: true,
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    price: 999,
    status: 'Low Stock',
    category: 'Phones',
    brand: 'Apple',
    createdAt: new Date('2024-02-10'),
    isActive: true,
  },
  {
    id: '3',
    name: 'Samsung Galaxy S24',
    price: 899,
    status: 'Out of Stock',
    category: 'Phones',
    brand: 'Samsung',
    createdAt: new Date('2024-01-20'),
    isActive: false,
  },
  {
    id: '4',
    name: 'Dell XPS 13',
    price: 1299,
    status: 'In Stock',
    category: 'Laptops',
    brand: 'Dell',
    createdAt: new Date('2024-03-01'),
    isActive: true,
  },
  {
    id: '5',
    name: 'iPad Air',
    price: 599,
    status: 'In Stock',
    category: 'Tablets',
    brand: 'Apple',
    createdAt: new Date('2024-02-15'),
    isActive: true,
  },
  {
    id: '6',
    name: 'MacBook Air M3',
    price: 1299,
    status: 'In Stock',
    category: 'Laptops',
    brand: 'Apple',
    createdAt: new Date('2024-03-10'),
    isActive: true,
  },
  {
    id: '7',
    name: 'Samsung Galaxy Tab S9',
    price: 799,
    status: 'Low Stock',
    category: 'Tablets',
    brand: 'Samsung',
    createdAt: new Date('2024-02-28'),
    isActive: true,
  },
  {
    id: '8',
    name: 'AirPods Pro',
    price: 249,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'Apple',
    createdAt: new Date('2024-03-05'),
    isActive: true,
  },
  {
    id: '9',
    name: 'Google Pixel 8',
    price: 699,
    status: 'Out of Stock',
    category: 'Phones',
    brand: 'Google',
    createdAt: new Date('2024-01-25'),
    isActive: false,
  },
  {
    id: '10',
    name: 'ThinkPad X1 Carbon',
    price: 1899,
    status: 'In Stock',
    category: 'Laptops',
    brand: 'Lenovo',
    createdAt: new Date('2024-02-20'),
    isActive: true,
  },
  {
    id: '11',
    name: 'Surface Pro 9',
    price: 1199,
    status: 'Low Stock',
    category: 'Tablets',
    brand: 'Microsoft',
    createdAt: new Date('2024-01-30'),
    isActive: true,
  },
  {
    id: '12',
    name: 'Samsung Galaxy Buds',
    price: 149,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'Samsung',
    createdAt: new Date('2024-03-12'),
    isActive: true,
  },
  {
    id: '13',
    name: 'HP Spectre x360',
    price: 1599,
    status: 'Out of Stock',
    category: 'Laptops',
    brand: 'HP',
    createdAt: new Date('2024-02-05'),
    isActive: false,
  },
  {
    id: '14',
    name: 'OnePlus 12',
    price: 799,
    status: 'In Stock',
    category: 'Phones',
    brand: 'OnePlus',
    createdAt: new Date('2024-03-08'),
    isActive: true,
  },
  {
    id: '15',
    name: 'Magic Mouse',
    price: 99,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'Apple',
    createdAt: new Date('2024-02-25'),
    isActive: true,
  },
  // Adding more products for pagination testing (16-50)
  ...Array.from({ length: 35 }, (_, i) => {
    const id = (16 + i).toString();
    const brands = [
      'Apple',
      'Samsung',
      'Google',
      'Microsoft',
      'Sony',
      'Dell',
      'HP',
      'Asus',
    ];
    const categories = [
      'Laptops',
      'Phones',
      'Tablets',
      'Accessories',
      'Audio',
      'Gaming',
    ];
    const statuses = ['In Stock', 'Low Stock', 'Out of Stock'] as const;

    return {
      id,
      name: `Product ${id}`,
      price: Math.floor(Math.random() * 2000) + 100,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      brand: brands[Math.floor(Math.random() * brands.length)],
      createdAt: new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1
      ),
      isActive: Math.random() > 0.3,
    } as Product;
  }),
];

// Removed unused helper functions

// Server actions using real API routes - Production-ready approach
export const productActions = {
  list: async (params: {
    page?: number;
    limit?: number;
    filters?: Record<string, unknown> | Array<{ id: string; value: unknown }>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    search?: string;
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex API logic needed for production functionality
  }) => {
    if (DEBUG) {
      console.log('🔥 API call with params:', params);
    }

    const {
      page = 0, // Use 0-based pagination as expected by the table
      limit = 10,
      filters = {},
      orderBy = {},
      search = '',
    } = params;

    // Build URL parameters for the API call
    const urlParams = new URLSearchParams({
      page: page.toString(),
      pageSize: limit.toString(),
    });

    // Add search parameter
    if (search) {
      urlParams.append('search', search);
    }

    // Add sorting parameters
    if (Object.keys(orderBy).length > 0) {
      const [sortBy, sortDirection] = Object.entries(orderBy)[0];
      urlParams.append('sortBy', sortBy);
      urlParams.append('sortDirection', sortDirection);
    }

    // Add filter parameters
    if (Array.isArray(filters)) {
      for (const filter of filters) {
        if (filter.id && filter.value) {
          urlParams.append(filter.id, String(filter.value));
        }
      }
    } else if (typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          urlParams.append(key, String(value));
        }
      }
    }

    try {
      // Make the API call
      const response = await fetch(`/api/products?${urlParams.toString()}`);

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (DEBUG) {
        console.log('🎯 API response:', result);
      }

      return {
        data: result.data,
        meta: {
          pageCount: result.meta.pageCount,
          totalCount: result.meta.totalCount,
        },
      };
    } catch (error) {
      console.error('❌ API call failed:', error);
      return {
        data: [],
        meta: {
          pageCount: 0,
          totalCount: 0,
        },
      };
    }
  },

  create: async (
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      // Generate a new ID
      const newId =
        Math.max(...products.map((p) => Number.parseInt(p.id, 10))) + 1;
      const newProduct: Product = {
        id: newId.toString(),
        name: (data.name as string) || '',
        price: (data.price as number) || 0,
        status: (data.status as Product['status']) || 'In Stock',
        category: (data.category as string) || '',
        brand: (data.brand as string) || '',
        isActive: (data.isActive as boolean) ?? true,
        createdAt: new Date(),
      };

      // Add to products array (in real app, this would be a database operation)
      products.push(newProduct);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, data: newProduct };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create product',
      };
    }
  },

  update: async (
    id: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      // Find the product to update
      const productIndex = products.findIndex((p) => p.id === id);
      if (productIndex === -1) {
        throw new Error(`Product with id ${id} not found`);
      }

      // Update the product, ensuring all required fields are present
      const updatedProduct: Product = {
        ...products[productIndex],
        name: (data.name as string) ?? products[productIndex].name,
        price: (data.price as number) ?? products[productIndex].price,
        status:
          (data.status as Product['status']) ?? products[productIndex].status,
        category: (data.category as string) ?? products[productIndex].category,
        brand: (data.brand as string) ?? products[productIndex].brand,
        isActive: (data.isActive as boolean) ?? products[productIndex].isActive,
        id, // Keep the original ID
      };

      // Update in products array (in real app, this would be a database operation)
      products[productIndex] = updatedProduct;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, data: updatedProduct };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update product',
      };
    }
  },

  delete: async (
    id: string
  ): Promise<{ success: boolean; data?: Product; error?: string }> => {
    try {
      // Find the product to delete
      const productIndex = products.findIndex((p) => p.id === id);
      if (productIndex === -1) {
        throw new Error(`Product with id ${id} not found`);
      }

      // Remove from products array (in real app, this would be a database operation)
      const deletedProduct = products.splice(productIndex, 1)[0];
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, data: deletedProduct };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete product',
      };
    }
  },
};
