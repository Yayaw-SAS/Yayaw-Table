import { z } from "zod";

// Validation schema for product records.
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0, "Price must be positive"),
  status: z.enum(["In Stock", "Low Stock", "Out of Stock"]),
  category: z.string().min(1, "Category is required"),
  brand: z.string().min(1, "Brand is required"),
  createdAt: z.date(),
  isActive: z.boolean().default(true),
});

export type Product = z.infer<typeof ProductSchema>;

// Partial payload used for product creation.
export type CreateProductData = Omit<Product, "id" | "createdAt">;

// Partial payload used for product updates.
export type UpdateProductData = Partial<Omit<Product, "id">>;
