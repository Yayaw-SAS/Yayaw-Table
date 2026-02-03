import { z } from "zod";

// Schema de validation pour les produits
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

// Type pour les données partielles lors de la création
export type CreateProductData = Omit<Product, "id" | "createdAt">;

// Type pour les données partielles lors de la mise à jour
export type UpdateProductData = Partial<Omit<Product, "id">>;
