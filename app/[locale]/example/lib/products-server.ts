/**
 * Server-only module: list, filter, sort, paginate and CRUD for products.
 * Used by Server Actions. Data is in-memory (resets on serverless cold start).
 */

import type { CalculationType } from "@/src/components/ui/yayaw-table/types/footer-types";
import { calculateColumn } from "@/src/components/ui/yayaw-table/utils/column-calculations";
import { products as initialProducts } from "../data";
import type { Product } from "../setup/types";

function evaluateTextFilter(
  value: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const textValue = String(value ?? "").toLowerCase();
  const searchValue = String(values[0] ?? "").toLowerCase();
  switch (operator) {
    case "contains":
      return textValue.includes(searchValue);
    case "equals":
      return textValue === searchValue;
    case "startsWith":
      return textValue.startsWith(searchValue);
    case "endsWith":
      return textValue.endsWith(searchValue);
    case "notContains":
      return !textValue.includes(searchValue);
    case "isEmpty":
      return !textValue || textValue.trim() === "";
    case "isNotEmpty":
      return Boolean(textValue && textValue.trim() !== "");
    default:
      return textValue.includes(searchValue);
  }
}

function evaluateNumberFilter(
  value: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const numValue = Number(value);
  const filterValue = Number(values[0]);
  switch (operator) {
    case "equals":
      return numValue === filterValue;
    case "notEquals":
      return numValue !== filterValue;
    case "greaterThan":
      return numValue > filterValue;
    case "lessThan":
      return numValue < filterValue;
    case "greaterThanOrEqual":
      return numValue >= filterValue;
    case "lessThanOrEqual":
      return numValue <= filterValue;
    case "between":
      if (Array.isArray(values) && values.length >= 2) {
        const min = Number(values[0]);
        const max = Number(values[1]);
        return (
          !(Number.isNaN(min) || Number.isNaN(max)) &&
          numValue >= min &&
          numValue <= max
        );
      }
      return false;
    case "isEmpty":
      return value == null || value === "" || Number.isNaN(numValue);
    case "isNotEmpty":
      return value != null && value !== "" && !Number.isNaN(numValue);
    default:
      return numValue === filterValue;
  }
}

function evaluateSelectFilter(
  value: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const list = Array.isArray(values) ? values : [values];
  if (operator === "in") {
    return list.includes(value);
  }
  return list.includes(value);
}

function toValidDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return;
}

function startOfDay(date: Date): Date {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
}

function endOfDay(date: Date): Date {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(23, 59, 59, 999);
  return normalizedDate;
}

function hasSameCalendarDay(leftDate: Date, rightDate: Date): boolean {
  return startOfDay(leftDate).getTime() === startOfDay(rightDate).getTime();
}

function normalizeDateRange(values: unknown[]): [Date, Date] | undefined {
  const startDate = toValidDate(values[0]);
  const endDate = toValidDate(values[1] ?? values[0]);
  if (!(startDate && endDate)) {
    return;
  }

  return startDate.getTime() <= endDate.getTime()
    ? [startDate, endDate]
    : [endDate, startDate];
}

function compareWithSingleDate(
  dateValue: Date,
  operator: string,
  targetDate: Date | undefined
): boolean {
  if (!targetDate) {
    return false;
  }

  switch (operator) {
    case "after":
      return dateValue.getTime() > endOfDay(targetDate).getTime();
    case "before":
      return dateValue.getTime() < startOfDay(targetDate).getTime();
    case "notEquals":
      return !hasSameCalendarDay(dateValue, targetDate);
    default:
      return hasSameCalendarDay(dateValue, targetDate);
  }
}

function evaluateDateFilter(
  value: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const dateValue = toValidDate(value);
  const operatorKey = String(operator ?? "");

  if (operatorKey === "isEmpty") {
    return !dateValue;
  }

  if (operatorKey === "isNotEmpty") {
    return Boolean(dateValue);
  }

  if (!dateValue) {
    return false;
  }

  if (operatorKey === "between") {
    const dateRange = normalizeDateRange(values);
    if (!dateRange) {
      return false;
    }
    const [rangeStart, rangeEnd] = dateRange;
    const timeValue = dateValue.getTime();
    return (
      timeValue >= startOfDay(rangeStart).getTime() &&
      timeValue <= endOfDay(rangeEnd).getTime()
    );
  }

  return compareWithSingleDate(dateValue, operatorKey, toValidDate(values[0]));
}

function applyAdvancedFilter(
  product: Product,
  filter: Record<string, unknown>
): boolean {
  const operator = String(filter.operator ?? "");
  const operatorNeedsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const valuesArray = Array.isArray(filter.values)
    ? (filter.values as unknown[])
    : [filter.values];
  const hasMeaningfulValue = valuesArray.some(
    (v) => v !== undefined && v !== null && String(v).trim() !== ""
  );
  if (!filter.isActive || (operatorNeedsValue && !hasMeaningfulValue)) {
    return true;
  }
  const value = product[filter.columnId as keyof Product];
  const filterValues = valuesArray;
  switch (filter.type) {
    case "text":
      return evaluateTextFilter(value, filter.operator, filterValues);
    case "number":
      return evaluateNumberFilter(value, filter.operator, filterValues);
    case "select":
      return evaluateSelectFilter(value, filter.operator, filterValues);
    case "date":
      return evaluateDateFilter(value, filter.operator, filterValues);
    default:
      return true;
  }
}

function applyAdvancedFilters(
  productsList: Product[],
  filters: Record<string, unknown>[]
): Product[] {
  if (filters.length === 0) {
    return productsList;
  }
  return productsList.filter((product) =>
    filters.every((filter) => applyAdvancedFilter(product, filter))
  );
}

function applyLegacyFiltersToProducts(
  productsList: Product[],
  filters: Record<string, unknown> | Array<{ id: string; value: unknown }>
): Product[] {
  const resultList: Product[] = [...productsList];
  if (Array.isArray(filters)) {
    for (const filter of filters) {
      if (filter.id && (filter as { value?: unknown }).value) {
        const valueToMatch = String(
          (filter as { value?: unknown }).value
        ).toLowerCase();
        const next = resultList.filter((product) => {
          const value = product[filter.id as keyof Product];
          return String(value || "")
            .toLowerCase()
            .includes(valueToMatch);
        });
        resultList.length = 0;
        resultList.push(...next);
      }
    }
    return resultList;
  }
  for (const [key, value] of Object.entries(filters)) {
    if (!value) {
      continue;
    }
    const valueToMatch = String(value).toLowerCase();
    const next = resultList.filter((product) => {
      const productValue = product[key as keyof Product];
      return String(productValue || "")
        .toLowerCase()
        .includes(valueToMatch);
    });
    resultList.length = 0;
    resultList.push(...next);
  }
  return resultList;
}

function applySearchToProducts(
  productsList: Product[],
  search: string
): Product[] {
  if (!search) {
    return productsList;
  }
  const searchLower = search.toLowerCase();
  return productsList.filter(
    (product) =>
      product.name.toLowerCase().includes(searchLower) ||
      product.brand.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower) ||
      product.status.toLowerCase().includes(searchLower)
  );
}

function sortProducts(
  productsList: Product[],
  orderBy: Record<string, "asc" | "desc">
): Product[] {
  if (Object.keys(orderBy).length === 0) {
    return productsList;
  }
  const [sortBy, sortDirection] = Object.entries(orderBy)[0];
  return [...productsList].sort((a, b) => {
    const aValue = a[sortBy as keyof Product] as unknown as
      | string
      | number
      | Date;
    const bValue = b[sortBy as keyof Product] as unknown as
      | string
      | number
      | Date;
    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });
}

function paginateProducts(
  productsList: Product[],
  page: number,
  limit: number
): { data: Product[]; pageCount: number; totalCount: number } {
  const totalCount = productsList.length;
  const pageCount = Math.ceil(totalCount / limit);
  const zeroBasedPage = Math.max(0, page - 1);
  const startIndex = zeroBasedPage * limit;
  const endIndex = startIndex + limit;
  const data = productsList.slice(startIndex, endIndex);
  return { data, pageCount, totalCount };
}

const productsStore: Product[] = initialProducts.map((p) => ({
  ...p,
  createdAt:
    p.createdAt instanceof Date ? p.createdAt : new Date(String(p.createdAt)),
}));

export interface ListProductsParams {
  page?: number;
  limit?: number;
  filters?: Record<string, unknown> | Array<{ id: string; value: unknown }>;
  advancedFilters?: Array<{
    columnId: string;
    operator: string;
    values: unknown[];
    isActive: boolean;
    type: string;
  }>;
  orderBy?: Record<string, "asc" | "desc">;
  search?: string;
}

export interface AggregateProductsParams {
  filters?: Record<string, unknown> | Array<{ id: string; value: unknown }>;
  advancedFilters?: Array<{
    columnId: string;
    operator: string;
    values: unknown[];
    isActive: boolean;
    type: string;
  }>;
  orderBy?: Record<string, "asc" | "desc">;
  search?: string;
  calculations: Record<string, CalculationType>;
  locale?: string;
}

function resolveColumnType(values: unknown[]): string | undefined {
  const sampleValue = values.find(
    (value) => value !== null && value !== undefined && value !== ""
  );

  if (sampleValue instanceof Date) {
    return "date";
  }
  if (typeof sampleValue === "number") {
    return "number";
  }
  return;
}

export async function listProducts(params: ListProductsParams) {
  const {
    page = 1,
    limit = 10,
    filters = {},
    advancedFilters = [],
    orderBy = {},
    search = "",
  } = params;

  let filtered = applyAdvancedFilters(
    productsStore,
    advancedFilters as Record<string, unknown>[]
  );
  filtered = applyLegacyFiltersToProducts(filtered, filters);
  filtered = applySearchToProducts(filtered, search);
  const sorted = sortProducts(filtered, orderBy);
  const { data, pageCount, totalCount } = paginateProducts(sorted, page, limit);

  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    data,
    meta: { pageCount, totalCount },
  };
}

export async function aggregateProducts(params: AggregateProductsParams) {
  const {
    filters = {},
    advancedFilters = [],
    orderBy = {},
    search = "",
    calculations,
    locale,
  } = params;

  let filtered = applyAdvancedFilters(
    productsStore,
    advancedFilters as Record<string, unknown>[]
  );
  filtered = applyLegacyFiltersToProducts(filtered, filters);
  filtered = applySearchToProducts(filtered, search);
  const sorted = sortProducts(filtered, orderBy);

  const results = Object.fromEntries(
    Object.entries(calculations).map(([columnId, calculationType]) => {
      const values = sorted.map(
        (product) => product[columnId as keyof Product]
      ) as unknown[];
      const columnType = resolveColumnType(values);
      const calculation = calculateColumn(
        values,
        calculationType,
        columnType,
        locale
      );

      return [columnId, calculation];
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    results,
    meta: {
      totalCount: sorted.length,
    },
  };
}

export async function createProduct(data: Record<string, unknown>) {
  try {
    const newId =
      Math.max(...productsStore.map((p) => Number.parseInt(p.id, 10)), 0) + 1;
    const newProduct: Product = {
      id: String(newId),
      name: (data.name as string) || "",
      price: (data.price as number) || 0,
      status: (data.status as Product["status"]) || "In Stock",
      category: (data.category as string) || "",
      brand: (data.brand as string) || "",
      isActive: (data.isActive as boolean) ?? true,
      createdAt: new Date(),
    };
    productsStore.push(newProduct);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true as const, data: newProduct };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to create product",
    };
  }
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  try {
    const index = productsStore.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product with id ${id} not found`);
    }
    const updated: Product = {
      ...productsStore[index],
      name: (data.name as string) ?? productsStore[index].name,
      price: (data.price as number) ?? productsStore[index].price,
      status: (data.status as Product["status"]) ?? productsStore[index].status,
      category: (data.category as string) ?? productsStore[index].category,
      brand: (data.brand as string) ?? productsStore[index].brand,
      isActive: (data.isActive as boolean) ?? productsStore[index].isActive,
      id,
    };
    productsStore[index] = updated;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to update product",
    };
  }
}

export async function deleteProduct(id: string) {
  try {
    const index = productsStore.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product with id ${id} not found`);
    }
    const deleted = productsStore.splice(index, 1)[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true as const, data: deleted };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
}

export async function bulkDeleteProducts(ids: string[]) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const deleted: Product[] = [];
    for (const id of ids) {
      const index = productsStore.findIndex((p) => p.id === id);
      if (index !== -1) {
        const [item] = productsStore.splice(index, 1);
        deleted.push(item);
      }
    }
    return { success: true as const, data: deleted };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function bulkCopyProducts(ids: string[]) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const toCopy = productsStore.filter((p) => ids.includes(p.id));
    if (toCopy.length === 0) {
      throw new Error("No products found to copy");
    }
    const cleanData = toCopy.map(({ id: _id, createdAt: _c, ...rest }) => rest);
    const jsonData = JSON.stringify(cleanData, null, 2);
    return { success: true as const, data: jsonData };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function bulkUpdateProducts(
  ids: string[],
  updateData: Partial<Product>
) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const updated: Product[] = [];
    for (const id of ids) {
      const index = productsStore.findIndex((p) => p.id === id);
      if (index !== -1) {
        const updates = Object.entries(updateData).reduce(
          (acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, unknown>
        );
        productsStore[index] = {
          ...productsStore[index],
          ...updates,
        } as Product;
        updated.push(productsStore[index]);
      }
    }
    return { success: true as const, data: updated };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
