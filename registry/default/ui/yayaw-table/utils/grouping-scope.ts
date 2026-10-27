import {
  DEFAULT_SCOPED_MAX_ROWS,
  DEFAULT_SCOPED_PAGE_SIZE,
  loadScopedRows,
  type ScopedRowsRequest,
} from "./scoped-rows";
import { type ContractRecord, positiveInteger } from "./table-contracts";

/** Rows that grouping covers: the page shown, or every row matching the query. */
export type GroupingScope = "all" | "page";

interface GroupingScopeConfig {
  enableGrouping?: boolean;
  groupingScope?: GroupingScope;
}

/** Whether the table loads every matching row to group them, not only the page. */
export function shouldGroupAllRows(
  config: GroupingScopeConfig,
  grouping: unknown
): boolean {
  return (
    config.groupingScope === "all" &&
    config.enableGrouping !== false &&
    Array.isArray(grouping) &&
    grouping.length > 0
  );
}

export interface GroupedRowsResult<TData> {
  data: TData[];
  /** One page: the groups replace pagination. */
  pageCount: number;
  rowCount: number;
  /** More rows matched than `groupingMaxRows`; the groups cover the first ones. */
  truncated: boolean;
}

/**
 * Every row matching the list parameters (search, filters, sort), page by
 * page, up to `maxRows`, so grouping covers them all instead of one page.
 */
export async function loadAllGroupedRows<TData>(
  list: NonNullable<ScopedRowsRequest["list"]>,
  params: ContractRecord,
  maxRows?: number
): Promise<GroupedRowsResult<TData>> {
  const loaded = await loadScopedRows({
    list,
    maxRows: positiveInteger(maxRows, DEFAULT_SCOPED_MAX_ROWS),
    pageSize: DEFAULT_SCOPED_PAGE_SIZE,
    params,
  });
  return {
    data: loaded.rows as TData[],
    pageCount: 1,
    rowCount: loaded.rows.length,
    truncated: loaded.truncated,
  };
}
