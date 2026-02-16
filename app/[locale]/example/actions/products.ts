"use server";

import {
  bulkCopyProducts,
  bulkDeleteProducts,
  bulkUpdateProducts,
  createProduct as createProductImpl,
  deleteProduct as deleteProductImpl,
  type ListProductsParams,
  listProducts as listProductsImpl,
  updateProduct as updateProductImpl,
} from "../lib/products-server";

export async function listProducts(params: ListProductsParams) {
  return await listProductsImpl(params);
}

export async function createProduct(data: Record<string, unknown>) {
  return await createProductImpl(data);
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  return await updateProductImpl(id, data);
}

export async function deleteProduct(id: string) {
  return await deleteProductImpl(id);
}

export async function bulkDelete(ids: string[]) {
  return await bulkDeleteProducts(ids);
}

export async function bulkCopy(ids: string[]) {
  return await bulkCopyProducts(ids);
}

export async function bulkUpdate(
  ids: string[],
  updateData: Parameters<typeof bulkUpdateProducts>[1]
) {
  return await bulkUpdateProducts(ids, updateData);
}
