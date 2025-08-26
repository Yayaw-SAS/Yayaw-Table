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
  // Adding more products for pagination testing (16-50) with creative names
  {
    id: '16',
    name: 'Sony WH-1000XM5',
    price: 399,
    status: 'In Stock',
    category: 'Audio',
    brand: 'Sony',
    createdAt: new Date('2024-01-12'),
    isActive: true,
  },
  {
    id: '17',
    name: 'ASUS ROG Strix Laptop',
    price: 1899,
    status: 'Low Stock',
    category: 'Gaming',
    brand: 'Asus',
    createdAt: new Date('2024-02-08'),
    isActive: true,
  },
  {
    id: '18',
    name: 'Nintendo Switch OLED',
    price: 349,
    status: 'In Stock',
    category: 'Gaming',
    brand: 'Nintendo',
    createdAt: new Date('2024-03-15'),
    isActive: true,
  },
  {
    id: '19',
    name: 'LG UltraWide Monitor',
    price: 599,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'LG',
    createdAt: new Date('2024-01-28'),
    isActive: true,
  },
  {
    id: '20',
    name: 'Razer DeathAdder V3',
    price: 89,
    status: 'In Stock',
    category: 'Gaming',
    brand: 'Razer',
    createdAt: new Date('2024-02-14'),
    isActive: true,
  },
  {
    id: '21',
    name: 'Canon EOS R6 Mark II',
    price: 2499,
    status: 'Low Stock',
    category: 'Cameras',
    brand: 'Canon',
    createdAt: new Date('2024-01-05'),
    isActive: true,
  },
  {
    id: '22',
    name: 'Logitech MX Master 3S',
    price: 99,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'Logitech',
    createdAt: new Date('2024-03-02'),
    isActive: true,
  },
  {
    id: '23',
    name: 'Tesla Model Y Charger',
    price: 549,
    status: 'Out of Stock',
    category: 'Automotive',
    brand: 'Tesla',
    createdAt: new Date('2024-02-22'),
    isActive: false,
  },
  {
    id: '24',
    name: 'Bose QuietComfort Earbuds',
    price: 279,
    status: 'In Stock',
    category: 'Audio',
    brand: 'Bose',
    createdAt: new Date('2024-01-18'),
    isActive: true,
  },
  {
    id: '25',
    name: 'Microsoft Surface Studio',
    price: 3199,
    status: 'Low Stock',
    category: 'Laptops',
    brand: 'Microsoft',
    createdAt: new Date('2024-03-07'),
    isActive: true,
  },
  {
    id: '26',
    name: 'DJI Mavic Air 3',
    price: 1099,
    status: 'In Stock',
    category: 'Drones',
    brand: 'DJI',
    createdAt: new Date('2024-02-18'),
    isActive: true,
  },
  {
    id: '27',
    name: 'Corsair K95 RGB Platinum',
    price: 199,
    status: 'In Stock',
    category: 'Gaming',
    brand: 'Corsair',
    createdAt: new Date('2024-01-22'),
    isActive: true,
  },
  {
    id: '28',
    name: 'GoPro HERO12 Black',
    price: 399,
    status: 'Low Stock',
    category: 'Cameras',
    brand: 'GoPro',
    createdAt: new Date('2024-03-11'),
    isActive: true,
  },
  {
    id: '29',
    name: 'Oculus Quest 3',
    price: 499,
    status: 'In Stock',
    category: 'VR',
    brand: 'Meta',
    createdAt: new Date('2024-02-26'),
    isActive: true,
  },
  {
    id: '30',
    name: 'Anker PowerCore 26800',
    price: 65,
    status: 'In Stock',
    category: 'Accessories',
    brand: 'Anker',
    createdAt: new Date('2024-01-14'),
    isActive: true,
  },
  {
    id: '31',
    name: 'Herman Miller Aeron Chair',
    price: 1395,
    status: 'Out of Stock',
    category: 'Furniture',
    brand: 'Herman Miller',
    createdAt: new Date('2024-02-04'),
    isActive: false,
  },
  {
    id: '32',
    name: 'Dyson V15 Detect',
    price: 749,
    status: 'In Stock',
    category: 'Home',
    brand: 'Dyson',
    createdAt: new Date('2024-03-16'),
    isActive: true,
  },
  {
    id: '33',
    name: 'NVIDIA GeForce RTX 4090',
    price: 1599,
    status: 'Low Stock',
    category: 'Gaming',
    brand: 'NVIDIA',
    createdAt: new Date('2024-01-09'),
    isActive: true,
  },
  {
    id: '34',
    name: 'Fitbit Charge 6',
    price: 159,
    status: 'In Stock',
    category: 'Wearables',
    brand: 'Fitbit',
    createdAt: new Date('2024-02-12'),
    isActive: true,
  },
  {
    id: '35',
    name: 'Sonos Arc Soundbar',
    price: 899,
    status: 'In Stock',
    category: 'Audio',
    brand: 'Sonos',
    createdAt: new Date('2024-03-04'),
    isActive: true,
  },
  {
    id: '36',
    name: 'Apple Studio Display',
    price: 1599,
    status: 'Low Stock',
    category: 'Accessories',
    brand: 'Apple',
    createdAt: new Date('2024-01-26'),
    isActive: true,
  },
  {
    id: '37',
    name: 'Secretlab TITAN Evo',
    price: 519,
    status: 'In Stock',
    category: 'Gaming',
    brand: 'Secretlab',
    createdAt: new Date('2024-02-16'),
    isActive: true,
  },
  {
    id: '38',
    name: 'Kindle Paperwhite',
    price: 149,
    status: 'In Stock',
    category: 'Electronics',
    brand: 'Amazon',
    createdAt: new Date('2024-03-09'),
    isActive: true,
  },
  {
    id: '39',
    name: 'Elgato Stream Deck',
    price: 149,
    status: 'Out of Stock',
    category: 'Gaming',
    brand: 'Elgato',
    createdAt: new Date('2024-01-31'),
    isActive: false,
  },
  {
    id: '40',
    name: 'Breville Barista Express',
    price: 699,
    status: 'In Stock',
    category: 'Kitchen',
    brand: 'Breville',
    createdAt: new Date('2024-02-29'),
    isActive: true,
  },
  {
    id: '41',
    name: 'Garmin Fenix 7X',
    price: 899,
    status: 'Low Stock',
    category: 'Wearables',
    brand: 'Garmin',
    createdAt: new Date('2024-01-07'),
    isActive: true,
  },
  {
    id: '42',
    name: 'Rode PodMic USB',
    price: 199,
    status: 'In Stock',
    category: 'Audio',
    brand: 'Rode',
    createdAt: new Date('2024-03-13'),
    isActive: true,
  },
  {
    id: '43',
    name: 'Wacom Cintiq 22',
    price: 1199,
    status: 'In Stock',
    category: 'Creative',
    brand: 'Wacom',
    createdAt: new Date('2024-02-07'),
    isActive: true,
  },
  {
    id: '44',
    name: 'Steam Deck OLED',
    price: 549,
    status: 'Low Stock',
    category: 'Gaming',
    brand: 'Valve',
    createdAt: new Date('2024-01-19'),
    isActive: true,
  },
  {
    id: '45',
    name: 'Philips Hue Bridge Kit',
    price: 199,
    status: 'In Stock',
    category: 'Smart Home',
    brand: 'Philips',
    createdAt: new Date('2024-03-06'),
    isActive: true,
  },
  {
    id: '46',
    name: 'Beats Studio Pro',
    price: 349,
    status: 'Out of Stock',
    category: 'Audio',
    brand: 'Beats',
    createdAt: new Date('2024-02-21'),
    isActive: false,
  },
  {
    id: '47',
    name: 'Framework Laptop 13',
    price: 1049,
    status: 'In Stock',
    category: 'Laptops',
    brand: 'Framework',
    createdAt: new Date('2024-01-16'),
    isActive: true,
  },
  {
    id: '48',
    name: 'Yeti X Professional',
    price: 169,
    status: 'In Stock',
    category: 'Audio',
    brand: 'Blue Yeti',
    createdAt: new Date('2024-03-01'),
    isActive: true,
  },
  {
    id: '49',
    name: 'Roomba j7+ Combo',
    price: 899,
    status: 'Low Stock',
    category: 'Home',
    brand: 'iRobot',
    createdAt: new Date('2024-02-13'),
    isActive: true,
  },
  {
    id: '50',
    name: 'Tesla Cybertruck Toolkit',
    price: 299,
    status: 'In Stock',
    category: 'Automotive',
    brand: 'Tesla',
    createdAt: new Date('2024-01-03'),
    isActive: true,
  },
];

// Removed unused helper functions

// Server actions using real API routes - Production-ready approach
export const productActions = {
  list: async (params: {
    page?: number;
    limit?: number;
    filters?: Record<string, unknown> | Array<{ id: string; value: unknown }>;
    advancedFilters?: Array<{ columnId: string; operator: string; values: unknown[]; isActive: boolean; type: string }>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    search?: string;
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex API logic needed for production functionality
  }) => {
    const {
      page = 0, // Use 0-based pagination as expected by the table
      limit = 10,
      filters = {},
      advancedFilters = [],
      orderBy = {},
      search = '',
    } = params;

    if (DEBUG) {
      console.log('🔥 API call with params:', params);
      console.log('🔧 Advanced filters received:', advancedFilters);
    }

    // Apply advanced filters to the data
    let filteredProducts = [...products];
    
    if (advancedFilters.length > 0) {
      if (DEBUG) {
        console.log('🔧 Applying advanced filters to', filteredProducts.length, 'products');
      }
      
      filteredProducts = filteredProducts.filter((product) => {
        return advancedFilters.every((filter: any) => {
          if (!filter.isActive) return true;
          
          const value = product[filter.columnId as keyof Product];
          
          if (DEBUG) {
            console.log('🔧 Applying filter:', filter, 'to value:', value);
          }
          
          switch (filter.type) {
            case 'text':
              const textValue = String(value || '').toLowerCase();
              const searchValue = String(filter.values[0] || '').toLowerCase();
              
              switch (filter.operator) {
                case 'equals':
                  return textValue === searchValue;
                case 'contains':
                  return textValue.includes(searchValue);
                case 'startsWith':
                  return textValue.startsWith(searchValue);
                case 'endsWith':
                  return textValue.endsWith(searchValue);
                default:
                  return textValue.includes(searchValue);
              }
              
            case 'number':
              const numValue = Number(value);
              const filterValue = Number(filter.values[0]);
              
              switch (filter.operator) {
                case 'equals':
                  return numValue === filterValue;
                case 'greaterThan':
                  return numValue > filterValue;
                case 'lessThan':
                  return numValue < filterValue;
                case 'greaterThanOrEqual':
                  return numValue >= filterValue;
                case 'lessThanOrEqual':
                  return numValue <= filterValue;
                default:
                  return numValue === filterValue;
              }
              
            case 'option':
              if (filter.operator === 'in' && Array.isArray(filter.values)) {
                return filter.values.includes(value);
              }
              return filter.values.includes(value);
              
            case 'date':
              const dateValue = new Date(value as string);
              const filterDate = new Date(filter.values[0] as string);
              
              switch (filter.operator) {
                case 'equals':
                  return dateValue.toDateString() === filterDate.toDateString();
                case 'greaterThan':
                  return dateValue > filterDate;
                case 'lessThan':
                  return dateValue < filterDate;
                default:
                  return dateValue.toDateString() === filterDate.toDateString();
              }
              
            default:
              return true;
          }
        });
      });
      
      if (DEBUG) {
        console.log('🔧 After advanced filtering:', filteredProducts.length, 'products remain');
      }
    }

    // Process data directly instead of making API calls

    try {
      // Apply legacy filters to the already advanced-filtered products
      let finalProducts = [...filteredProducts];
      
      // Apply legacy filters if any
      if (Array.isArray(filters)) {
        for (const filter of filters) {
          if (filter.id && filter.value) {
            finalProducts = finalProducts.filter((product) => {
              const value = product[filter.id as keyof Product];
              return String(value || '').toLowerCase().includes(String(filter.value).toLowerCase());
            });
          }
        }
      } else if (typeof filters === 'object') {
        for (const [key, value] of Object.entries(filters)) {
          if (value) {
            finalProducts = finalProducts.filter((product) => {
              const productValue = product[key as keyof Product];
              return String(productValue || '').toLowerCase().includes(String(value).toLowerCase());
            });
          }
        }
      }

      // Apply search if present
      if (search) {
        finalProducts = finalProducts.filter((product) => {
          const searchLower = search.toLowerCase();
          return (
            product.name.toLowerCase().includes(searchLower) ||
            product.brand.toLowerCase().includes(searchLower) ||
            product.category.toLowerCase().includes(searchLower) ||
            product.status.toLowerCase().includes(searchLower)
          );
        });
      }

      // Apply sorting
      if (Object.keys(orderBy).length > 0) {
        const [sortBy, sortDirection] = Object.entries(orderBy)[0];
        finalProducts.sort((a, b) => {
          const aValue = a[sortBy as keyof Product];
          const bValue = b[sortBy as keyof Product];
          
          let comparison = 0;
          if (aValue < bValue) {
            comparison = -1;
          } else if (aValue > bValue) {
            comparison = 1;
          }
          
          return sortDirection === 'desc' ? -comparison : comparison;
        });
      }

      // Apply pagination
      const totalCount = finalProducts.length;
      const pageCount = Math.ceil(totalCount / limit);
      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = finalProducts.slice(startIndex, endIndex);

      const result = {
        data: paginatedProducts,
        meta: {
          pageCount,
          totalCount,
        },
      };

      if (DEBUG) {
        console.log('🎯 Processed result:', {
          'original products': products.length,
          'after advanced filters': filteredProducts.length,
          'after all filters': finalProducts.length,
          'paginated': paginatedProducts.length,
          'page': page,
          'limit': limit,
          'pageCount': pageCount,
          'totalCount': totalCount
        });
      }

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      return result;
    } catch (error) {
      console.error('❌ Data processing failed:', error);
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
