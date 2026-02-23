import type { TableActions } from "../providers/table-provider";

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

  const firstSort = sortParam[0] as { desc?: boolean; id?: string };
  if (typeof firstSort?.id !== "string") {
    return;
  }

  return {
    [firstSort.id]: firstSort.desc ? "desc" : "asc",
  };
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

export const toAdvancedFiltersParam = (advancedFiltersParam: unknown): unknown[] => {
  if (!Array.isArray(advancedFiltersParam)) {
    return [];
  }

  return advancedFiltersParam.filter((filter) => {
    if (!(filter && typeof filter === "object")) {
      return false;
    }

    return (filter as { isActive?: boolean }).isActive !== false;
  });
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
  const collectedRows: Record<string, unknown>[] = [];
  let page = 1;
  let knownPageCount: number | undefined;

  while (page <= MAX_FETCH_PAGES) {
    const requestParams: Record<string, unknown> = {
      advancedFilters,
      filters,
      limit: pageSize,
      page,
    };

    if (orderBy) {
      requestParams.orderBy = orderBy;
    }

    if (search.length > 0) {
      requestParams.search = search;
      requestParams.q = search;
      requestParams.globalSearch = search;
    }

    const response = await listAction(requestParams);
    const pageRows = toRecordRows(response.data);
    collectedRows.push(...pageRows);

    if (
      typeof response.meta?.pageCount === "number" &&
      response.meta.pageCount > 0
    ) {
      knownPageCount = response.meta.pageCount;
    }

    const reachedLastKnownPage =
      typeof knownPageCount === "number" && page >= knownPageCount;
    const reachedLastByPageSize = pageRows.length < pageSize;
    const hasNoMoreData = pageRows.length === 0;

    if (reachedLastKnownPage || reachedLastByPageSize || hasNoMoreData) {
      break;
    }

    page += 1;
  }

  return collectedRows;
};
