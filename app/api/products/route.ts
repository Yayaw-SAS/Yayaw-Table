import { type NextRequest, NextResponse } from "next/server";

// Import the mock data
const products = [
  {
    id: "1",
    name: 'MacBook Pro 16"',
    price: 2499,
    status: "In Stock",
    category: "Laptops",
    brand: "Apple",
    createdAt: new Date("2024-01-15"),
    isActive: true,
  },
  {
    id: "2",
    name: "Dell XPS 13",
    price: 1299,
    status: "In Stock",
    category: "Laptops",
    brand: "Dell",
    createdAt: new Date("2024-01-16"),
    isActive: true,
  },
  {
    id: "3",
    name: "iPhone 15 Pro",
    price: 999,
    status: "Out of Stock",
    category: "Phones",
    brand: "Apple",
    createdAt: new Date("2024-01-17"),
    isActive: true,
  },
  {
    id: "4",
    name: "Samsung Galaxy S24",
    price: 899,
    status: "In Stock",
    category: "Phones",
    brand: "Samsung",
    createdAt: new Date("2024-01-18"),
    isActive: false,
  },
  {
    id: "5",
    name: 'iPad Pro 12.9"',
    price: 1099,
    status: "In Stock",
    category: "Tablets",
    brand: "Apple",
    createdAt: new Date("2024-01-19"),
    isActive: true,
  },
  // Generate more products to reach 50
  ...Array.from({ length: 45 }, (_, i) => ({
    id: `${i + 6}`,
    name: `Product ${i + 6}`,
    price: Math.floor(Math.random() * 2000) + 100,
    status: Math.random() > 0.3 ? "In Stock" : "Out of Stock",
    category: ["Laptops", "Phones", "Tablets", "Accessories"][
      Math.floor(Math.random() * 4)
    ],
    brand: ["Apple", "Samsung", "Dell", "HP", "Sony"][
      Math.floor(Math.random() * 5)
    ],
    createdAt: new Date(2024, 0, 20 + i),
    isActive: Math.random() > 0.2,
  })),
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Parse pagination parameters
  const page = Number.parseInt(searchParams.get("page") || "0", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10);

  // Parse sorting parameters
  const sortBy = searchParams.get("sortBy");
  const sortDirection = searchParams.get("sortDirection") || "asc";

  // Parse filter parameters
  const search = searchParams.get("search")?.toLowerCase();
  const category = searchParams.get("category");
  const brand = searchParams.get("brand");
  const status = searchParams.get("status");

  // Start with all products
  let filteredProducts = [...products];

  // Apply filters
  if (search) {
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(search) ||
        product.brand.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search)
    );
  }

  if (category) {
    filteredProducts = filteredProducts.filter(
      (product) => product.category === category
    );
  }

  if (brand) {
    filteredProducts = filteredProducts.filter(
      (product) => product.brand === brand
    );
  }

  if (status) {
    filteredProducts = filteredProducts.filter(
      (product) => product.status === status
    );
  }

  // Apply sorting
  if (sortBy) {
    filteredProducts.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];

      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  // Calculate pagination
  const totalCount = filteredProducts.length;
  const pageCount = Math.ceil(totalCount / pageSize);
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;

  // Get page data
  const pageData = filteredProducts.slice(startIndex, endIndex);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return NextResponse.json({
    data: pageData,
    meta: {
      totalCount,
      pageCount,
      currentPage: page,
      pageSize,
      hasNextPage: page < pageCount - 1,
      hasPreviousPage: page > 0,
    },
  });
}
