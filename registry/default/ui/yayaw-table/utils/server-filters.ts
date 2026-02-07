/**
 * Utilities for handling server-side filtering in DataTable
 */
"use client";

/**
 * Interface for complex filter objects
 */
interface ComplexFilter {
  id: string;
  operator: string;
  value: string;
}

/**
 * Interface for filter objects
 */
interface Filter {
  id: string;
  value: unknown;
}

/**
 * Apply complex filters on the client side
 * @param data Array of data items
 * @param complexFilters Array of complex filters to apply
 * @returns Filtered data
 */
export function applyComplexFilters<T>(
  data: T[],
  complexFilters: ComplexFilter[]
) {
  // If no complex filters, return data as is
  if (complexFilters.length === 0) {
    return data;
  }

  // Apply each complex filter
  return data.filter((item) => {
    // Item must match all complex filters
    return complexFilters.every((filter) => {
      const fieldValue = String(
        (item as Record<string, unknown>)[filter.id] || ""
      ).toLowerCase();

      // Apply the appropriate operator (filter.value already lowercased where needed)
      const filterVal = filter.value.toLowerCase();
      switch (filter.operator) {
        case "contains":
          return fieldValue.includes(filterVal);
        case "equals":
          return fieldValue === filterVal;
        case "startsWith":
          return fieldValue.startsWith(filterVal);
        case "endsWith":
          return fieldValue.endsWith(filterVal);
        case "notContains":
          return !fieldValue.includes(filterVal);
        case "isEmpty":
          return !fieldValue || fieldValue.trim() === "";
        case "isNotEmpty":
          return Boolean(fieldValue && fieldValue.trim() !== "");
        default:
          return true; // Unknown operator, don't filter
      }
    });
  });
}

/**
 * Apply pagination to filtered data
 * @param data Array of filtered data
 * @param pageIndex Current page index (0-based)
 * @param pageSize Number of items per page
 * @returns Paginated data and pagination info
 */
export function applyPagination<T>(
  data: T[],
  pageIndex: number,
  pageSize: number
) {
  const startIndex = pageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = data.slice(startIndex, endIndex);

  return {
    data: paginatedData,
    pageCount: Math.ceil(data.length / pageSize),
    rowCount: data.length,
  };
}

// Helper function to process object-type filter values
function _processObjectFilter(
  filter: Filter,
  serverFilters: Record<string, unknown>,
  complexFilters: ComplexFilter[]
) {
  const valueObj = filter.value as Record<string, unknown>;

  if (valueObj.contains !== undefined) {
    // For 'contains' operator, store for client-side filtering
    complexFilters.push({
      id: filter.id,
      operator: "contains",
      value: String(valueObj.contains || "").toLowerCase(),
    });
    // Also add to serverFilters in a format the server can understand
    serverFilters[filter.id] = { contains: valueObj.contains };
  } else if (valueObj.value !== undefined) {
    // Use only the value part, not the operator
    serverFilters[filter.id] = valueObj.value;
  } else if (valueObj.equals !== undefined) {
    // For 'equals' operator, use the exact value
    complexFilters.push({
      id: filter.id,
      operator: "equals",
      value: String(valueObj.equals),
    });
    // Add to serverFilters in a format the server can understand
    serverFilters[filter.id] = valueObj.equals;
  } else if (valueObj.startsWith !== undefined) {
    // For 'startsWith' operator, use the exact value
    complexFilters.push({
      id: filter.id,
      operator: "startsWith",
      value: String(valueObj.startsWith),
    });
    // Add to serverFilters in a format the server can understand
    serverFilters[filter.id] = valueObj.startsWith;
  } else if (valueObj.endsWith !== undefined) {
    // For 'endsWith' operator, use the exact value
    complexFilters.push({
      id: filter.id,
      operator: "endsWith",
      value: String(valueObj.endsWith),
    });
    // Add to serverFilters in a format the server can understand
    serverFilters[filter.id] = valueObj.endsWith;
  }
}

/**
 * Process filters for server-side filtering
 * Handles complex filters like 'contains', 'startsWith', etc.
 * @param filters Array of filter objects from DataTable
 * @returns Object with processed filters and complex filters that need client-side processing
 */
export function processServerFilters(filters: Filter[]) {
  const serverFilters: Record<string, unknown> = {};
  const complexFilters: ComplexFilter[] = [];

  // Process each filter
  for (const filter of filters) {
    // Handle different filter types based on the value
    if (typeof filter.value === "object" && filter.value !== null) {
      _processObjectFilter(filter, serverFilters, complexFilters);
    } else if (filter.value !== undefined && filter.value !== "") {
      // For simple equality filters
      serverFilters[filter.id] = filter.value;
    }
  }

  return { complexFilters, serverFilters };
}
