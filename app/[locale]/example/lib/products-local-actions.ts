/**
 * Client-side local actions for the products example table.
 * Data is persisted in localStorage and shared across locales.
 */

import { products as seedProducts } from "../data";
import type { Product } from "../setup/types";

export const EXAMPLE_PRODUCTS_STORAGE_KEY = "yayaw-example-products:v1";

const DEFAULT_LATENCY_MS = 50;

const PRODUCT_STATUSES = ["In Stock", "Low Stock", "Out of Stock"] as const;
const URL_PROTOCOL_REGEX = /^https?:\/\//i;
const LEADING_SLASHES_REGEX = /^\/+/;

interface StorageAdapter {
  getItem: (key: string) => null | string;
  setItem: (key: string, value: string) => void;
}

interface PersistedProduct extends Omit<Product, "createdAt"> {
  createdAt: string;
}

interface ActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
}

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

export interface ProductsLocalActions {
  /**
   * Compatibility index signature for consumers expecting generic table actions.
   */
  [key: string]: unknown;
  list: (params: ListProductsParams) => Promise<{
    data: Product[];
    meta: { pageCount: number; totalCount: number };
  }>;
  create: (data: Record<string, unknown>) => Promise<ActionResult<Product>>;
  update: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<ActionResult<Product>>;
  delete: (id: string) => Promise<ActionResult<Product>>;
  bulkDelete: (ids: string[]) => Promise<ActionResult<Product[]>>;
  bulkCopy: (ids: string[]) => Promise<ActionResult<string>>;
  bulkUpdate: (
    ids: string[],
    updateData: Record<string, unknown>
  ) => Promise<ActionResult<Product[]>>;
  resetData: () => Promise<ActionResult<Product[]>>;
}

export interface CreateProductsLocalActionsOptions {
  storage?: StorageAdapter;
  latencyMs?: number;
  now?: () => Date;
}

const fallbackStorageMap = new Map<string, string>();

const fallbackStorage: StorageAdapter = {
  getItem: (key) => fallbackStorageMap.get(key) ?? null,
  setItem: (key, value) => {
    fallbackStorageMap.set(key, value);
  },
};

function getBrowserStorage(): StorageAdapter | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    return window.localStorage;
  } catch {
    return;
  }
}

function resolveStorage(storage?: StorageAdapter): StorageAdapter {
  return storage ?? getBrowserStorage() ?? fallbackStorage;
}

function cloneSeedProducts(): Product[] {
  return seedProducts.map((product) => ({
    ...product,
    createdAt: new Date(product.createdAt),
  }));
}

function slugifySegment(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "item";
}

function buildProductWebsiteFromNameBrand(name: string, brand: string): string {
  const brandSlug = slugifySegment(brand);
  const productSlug = slugifySegment(name);
  return `https://www.${brandSlug}.example/products/${productSlug}/`;
}

function normalizeWebsiteValue({
  brand,
  fallback,
  name,
  value,
}: {
  brand: string;
  fallback: string;
  name: string;
  value: unknown;
}): string {
  const normalizedValue = toStringValue(value, fallback).trim();
  const websiteCandidate =
    normalizedValue.length > 0
      ? normalizedValue
      : buildProductWebsiteFromNameBrand(name, brand);

  if (URL_PROTOCOL_REGEX.test(websiteCandidate)) {
    return websiteCandidate;
  }

  return `https://${websiteCandidate.replace(LEADING_SLASHES_REGEX, "")}`;
}

function serializeProducts(productsList: Product[]): string {
  const persistedProducts: PersistedProduct[] = productsList.map((product) => ({
    ...product,
    createdAt: product.createdAt.toISOString(),
  }));
  return JSON.stringify(persistedProducts);
}

function parseProducts(raw: string): Product[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Products payload must be an array");
  }

  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Product entry must be an object");
    }

    const record = entry as Record<string, unknown>;
    const createdAt = new Date(String(record.createdAt ?? ""));
    const price = Number(record.price);

    if (
      typeof record.id !== "string" ||
      typeof record.name !== "string" ||
      !Number.isFinite(price) ||
      typeof record.category !== "string" ||
      typeof record.brand !== "string" ||
      typeof record.isActive !== "boolean" ||
      !(record.status && PRODUCT_STATUSES.includes(record.status as never)) ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw new Error("Invalid product in persisted payload");
    }

    return {
      id: record.id,
      name: record.name,
      price,
      status: record.status as Product["status"],
      category: record.category,
      brand: record.brand,
      website: normalizeWebsiteValue({
        brand: record.brand,
        fallback: "",
        name: record.name,
        value: record.website,
      }),
      isActive: record.isActive,
      createdAt,
    };
  });
}

function writeProducts(storage: StorageAdapter, productsList: Product[]): void {
  storage.setItem(
    EXAMPLE_PRODUCTS_STORAGE_KEY,
    serializeProducts(productsList)
  );
}

function readProducts(storage: StorageAdapter): Product[] {
  const raw = storage.getItem(EXAMPLE_PRODUCTS_STORAGE_KEY);

  if (!raw) {
    const initialData = cloneSeedProducts();
    writeProducts(storage, initialData);
    return initialData;
  }

  try {
    return parseProducts(raw);
  } catch {
    // Corrupted payload: restore deterministic seed and overwrite storage.
    const initialData = cloneSeedProducts();
    writeProducts(storage, initialData);
    return initialData;
  }
}

function normalizeStatus(
  value: unknown,
  fallback: Product["status"]
): Product["status"] {
  if (typeof value === "string" && PRODUCT_STATUSES.includes(value as never)) {
    return value as Product["status"];
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return fallback;
  }

  return String(value);
}

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
    (value) =>
      value !== undefined && value !== null && String(value).trim() !== ""
  );

  if (!filter.isActive || (operatorNeedsValue && !hasMeaningfulValue)) {
    return true;
  }

  const value = product[filter.columnId as keyof Product];
  switch (filter.type) {
    case "text":
      return evaluateTextFilter(value, filter.operator, valuesArray);
    case "number":
      return evaluateNumberFilter(value, filter.operator, valuesArray);
    case "select":
      return evaluateSelectFilter(value, filter.operator, valuesArray);
    case "date":
      return evaluateDateFilter(value, filter.operator, valuesArray);
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
  const resultList = [...productsList];

  if (Array.isArray(filters)) {
    for (const filter of filters) {
      if (filter.id && filter.value) {
        const valueToMatch = String(filter.value).toLowerCase();
        const filtered = resultList.filter((product) => {
          const value = product[filter.id as keyof Product];
          return String(value ?? "")
            .toLowerCase()
            .includes(valueToMatch);
        });
        resultList.length = 0;
        resultList.push(...filtered);
      }
    }
    return resultList;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value) {
      continue;
    }
    const valueToMatch = String(value).toLowerCase();
    const filtered = resultList.filter((product) => {
      const productValue = product[key as keyof Product];
      return String(productValue ?? "")
        .toLowerCase()
        .includes(valueToMatch);
    });
    resultList.length = 0;
    resultList.push(...filtered);
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
  return [...productsList].sort((left, right) => {
    const leftValue = left[sortBy as keyof Product] as unknown as
      | string
      | number
      | Date;
    const rightValue = right[sortBy as keyof Product] as unknown as
      | string
      | number
      | Date;
    let comparison = 0;
    if (leftValue < rightValue) {
      comparison = -1;
    } else if (leftValue > rightValue) {
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
  return {
    data: productsList.slice(startIndex, endIndex),
    pageCount,
    totalCount,
  };
}

function getNextProductId(productsList: Product[]): string {
  let maxId = 0;
  for (const product of productsList) {
    const parsedId = Number.parseInt(product.id, 10);
    if (!Number.isNaN(parsedId) && parsedId > maxId) {
      maxId = parsedId;
    }
  }
  return String(maxId + 1);
}

function isMeaningfulUpdateValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function applyBulkUpdatePayload(
  product: Product,
  updateData: Record<string, unknown>
): Product {
  let nextProduct = { ...product };

  for (const [key, value] of Object.entries(updateData)) {
    if (!isMeaningfulUpdateValue(value) || key === "id") {
      continue;
    }

    switch (key) {
      case "name":
        nextProduct = {
          ...nextProduct,
          name: toStringValue(value, nextProduct.name),
        };
        break;
      case "price":
        nextProduct = {
          ...nextProduct,
          price: normalizeNumber(value, nextProduct.price),
        };
        break;
      case "status":
        nextProduct = {
          ...nextProduct,
          status: normalizeStatus(value, nextProduct.status),
        };
        break;
      case "category":
        nextProduct = {
          ...nextProduct,
          category: toStringValue(value, nextProduct.category),
        };
        break;
      case "brand":
        nextProduct = {
          ...nextProduct,
          brand: toStringValue(value, nextProduct.brand),
        };
        break;
      case "website":
        nextProduct = {
          ...nextProduct,
          website: normalizeWebsiteValue({
            brand: nextProduct.brand,
            fallback: nextProduct.website ?? "",
            name: nextProduct.name,
            value,
          }),
        };
        break;
      case "isActive":
        if (typeof value === "boolean") {
          nextProduct = { ...nextProduct, isActive: value };
        }
        break;
      case "createdAt": {
        const parsedDate = toValidDate(value);
        if (parsedDate) {
          nextProduct = { ...nextProduct, createdAt: parsedDate };
        }
        break;
      }
      default:
        break;
    }
  }

  return nextProduct;
}

function applyProductUpdatePayload({
  data,
  id,
  current,
}: {
  current: Product;
  data: Record<string, unknown>;
  id: string;
}): Product {
  const nextName =
    data.name == null ? current.name : toStringValue(data.name, current.name);
  const nextBrand =
    data.brand == null
      ? current.brand
      : toStringValue(data.brand, current.brand);

  return {
    ...current,
    name: nextName,
    price:
      data.price == null
        ? current.price
        : normalizeNumber(data.price, current.price),
    status:
      data.status == null
        ? current.status
        : normalizeStatus(data.status, current.status),
    category:
      data.category == null
        ? current.category
        : toStringValue(data.category, current.category),
    brand: nextBrand,
    website: normalizeWebsiteValue({
      brand: nextBrand,
      fallback: current.website ?? "",
      name: nextName,
      value: data.website,
    }),
    isActive:
      data.isActive == null || typeof data.isActive !== "boolean"
        ? current.isActive
        : data.isActive,
    id,
  };
}

async function waitForLatency(latencyMs: number): Promise<void> {
  if (latencyMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, latencyMs);
  });
}

export function createProductsLocalActions(
  options: CreateProductsLocalActionsOptions = {}
): ProductsLocalActions {
  const storage = resolveStorage(options.storage);
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  const now = options.now ?? (() => new Date());

  return {
    list: async (params) => {
      const {
        page = 1,
        limit = 10,
        filters = {},
        advancedFilters = [],
        orderBy = {},
        search = "",
      } = params;

      const productsList = readProducts(storage);
      let filtered = applyAdvancedFilters(
        productsList,
        advancedFilters as Record<string, unknown>[]
      );
      filtered = applyLegacyFiltersToProducts(filtered, filters);
      filtered = applySearchToProducts(filtered, search);
      const sorted = sortProducts(filtered, orderBy);
      const { data, pageCount, totalCount } = paginateProducts(
        sorted,
        page,
        limit
      );

      await waitForLatency(latencyMs);

      return {
        data,
        meta: { pageCount, totalCount },
      };
    },

    create: async (data) => {
      try {
        const productsList = readProducts(storage);
        const productName = toStringValue(data.name, "");
        const productBrand = toStringValue(data.brand, "");
        const newProduct: Product = {
          id: getNextProductId(productsList),
          name: productName,
          price: normalizeNumber(data.price, 0),
          status: normalizeStatus(data.status, "In Stock"),
          category: toStringValue(data.category, ""),
          brand: productBrand,
          website: normalizeWebsiteValue({
            brand: productBrand,
            fallback: "",
            name: productName,
            value: data.website,
          }),
          isActive: typeof data.isActive === "boolean" ? data.isActive : true,
          createdAt: now(),
        };

        const updatedProducts = [...productsList, newProduct];
        writeProducts(storage, updatedProducts);
        await waitForLatency(latencyMs);
        return { success: true, data: newProduct };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create product",
        };
      }
    },

    update: async (id, data) => {
      try {
        const productsList = readProducts(storage);
        const index = productsList.findIndex((product) => product.id === id);
        if (index === -1) {
          throw new Error(`Product with id ${id} not found`);
        }

        const current = productsList[index];
        const updatedProduct = applyProductUpdatePayload({
          current,
          data,
          id,
        });

        const updatedProducts = [...productsList];
        updatedProducts[index] = updatedProduct;
        writeProducts(storage, updatedProducts);
        await waitForLatency(latencyMs);
        return { success: true, data: updatedProduct };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update product",
        };
      }
    },

    delete: async (id) => {
      try {
        const productsList = readProducts(storage);
        const index = productsList.findIndex((product) => product.id === id);
        if (index === -1) {
          throw new Error(`Product with id ${id} not found`);
        }

        const updatedProducts = [...productsList];
        const deleted = updatedProducts.splice(index, 1)[0];
        writeProducts(storage, updatedProducts);
        await waitForLatency(latencyMs);
        return { success: true, data: deleted };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete product",
        };
      }
    },

    bulkDelete: async (ids) => {
      try {
        const productsList = readProducts(storage);
        const idsSet = new Set(ids);
        const deletedProducts = productsList.filter((product) =>
          idsSet.has(product.id)
        );
        const remainingProducts = productsList.filter(
          (product) => !idsSet.has(product.id)
        );
        writeProducts(storage, remainingProducts);
        await waitForLatency(latencyMs);
        return { success: true, data: deletedProducts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    bulkCopy: async (ids) => {
      try {
        const productsList = readProducts(storage);
        const idsSet = new Set(ids);
        const toCopy = productsList.filter((product) => idsSet.has(product.id));
        if (toCopy.length === 0) {
          throw new Error("No products found to copy");
        }

        const cleanData = toCopy.map(
          ({ id: _id, createdAt: _createdAt, ...rest }) => ({
            ...rest,
          })
        );
        await waitForLatency(latencyMs);
        return { success: true, data: JSON.stringify(cleanData, null, 2) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    bulkUpdate: async (ids, updateData) => {
      try {
        const productsList = readProducts(storage);
        const idsSet = new Set(ids);
        const updatedProducts: Product[] = [];
        const nextProducts = productsList.map((product) => {
          if (!idsSet.has(product.id)) {
            return product;
          }

          const nextProduct = applyBulkUpdatePayload(product, updateData);
          updatedProducts.push(nextProduct);
          return nextProduct;
        });

        writeProducts(storage, nextProducts);
        await waitForLatency(latencyMs);
        return { success: true, data: updatedProducts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },

    resetData: async () => {
      try {
        const initialData = cloneSeedProducts();
        writeProducts(storage, initialData);
        await waitForLatency(latencyMs);
        return { success: true, data: initialData };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to reset products",
        };
      }
    },
  };
}
