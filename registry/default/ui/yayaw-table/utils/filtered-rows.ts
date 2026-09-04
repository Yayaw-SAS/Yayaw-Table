import type { TableActions } from "../providers/table-provider";
import {
  fetchAllContractRows,
  normalizeFilterEnvelope,
} from "./table-contracts";

export type FilteredRowsOrderBy = Record<string, "asc" | "desc">;

export type TableListAction = NonNullable<TableActions["list"]>;

export const DEFAULT_FETCH_PAGE_SIZE = 100;
export const MAX_FETCH_PAGES = 1000;

export const toOrderByParam = (
  sortParam: unknown
): FilteredRowsOrderBy | undefined => {
  if (!Array.isArray(sortParam) || sortParam.length === 0) {
    return;
  }

  return Object.fromEntries(
    sortParam
      .filter((sort): sort is { id: string; desc?: boolean } =>
        Boolean(sort && typeof sort === "object" && typeof sort.id === "string")
      )
      .map((sort) => [sort.id, sort.desc ? "desc" : "asc"])
  );
};

export const toFiltersParam = (
  filtersParam: unknown
): Record<string, unknown> => {
  if (!Array.isArray(filtersParam)) {
    return {};
  }

  const parsedFilters = filtersParam as Array<{ id: string; value: unknown }>;
  return Object.fromEntries(
    parsedFilters
      .filter((filter) => !["global", "id", "key"].includes(filter.id))
      .map((filter) => [filter.id, filter.value])
  );
};

export const toAdvancedFiltersParam = (
  advancedFiltersParam: unknown
): unknown[] => {
  return normalizeFilterEnvelope(advancedFiltersParam).filters.filter(
    (filter) => filter.isActive !== false
  );
};

export const toPageSize = (
  pageSizeParam: string | undefined,
  fallback = DEFAULT_FETCH_PAGE_SIZE
): number => {
  const parsedPageSize = Number.parseInt(pageSizeParam || String(fallback), 10);
  if (Number.isNaN(parsedPageSize) || parsedPageSize < 1) {
    return fallback;
  }
  return parsedPageSize;
};

const toRecordRows = (data: unknown[]): Record<string, unknown>[] => {
  return data.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null
  );
};

export const fetchAllFilteredRows = async ({
  listAction,
  advancedFilters,
  filters,
  orderBy,
  pageSize,
  search,
}: {
  listAction: TableListAction;
  advancedFilters: unknown[];
  filters: Record<string, unknown>;
  orderBy?: FilteredRowsOrderBy;
  pageSize: number;
  search: string;
}): Promise<Record<string, unknown>[]> => {
  return toRecordRows(
    await fetchAllContractRows({
      list: listAction,
      params: { advancedFilters, filters, orderBy, pageSize, search },
      maxPages: MAX_FETCH_PAGES,
    })
  );
};
