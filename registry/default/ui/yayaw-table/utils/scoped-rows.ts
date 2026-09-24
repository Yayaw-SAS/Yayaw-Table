import {
  boundsContain,
  type LocationBounds,
  normalizeBounds,
  parseLocation,
} from "./location-model";
import { type ContractRecord, compatibleListParams } from "./table-contracts";

/**
 * A window a view needs rows for, such as the dates a calendar shows.
 * Days are local calendar days (`YYYY-MM-DD`), both ends inclusive.
 */
export interface DateRangeScope {
  kind: "dateRange";
  /** Column holding the start date, or the only date. */
  field: string;
  /** Column holding the end date; a row then overlaps the window when its span does. */
  endField?: string;
  from: string;
  to: string;
}

/**
 * The area a map shows: rows whose location column lies inside it. Degrees
 * (WGS 84); `west > east` crosses the antimeridian.
 */
export interface BoundsScope extends LocationBounds {
  kind: "bbox";
  /** Column holding the location. */
  field: string;
}

export type ListScope = BoundsScope | DateRangeScope;

type ListAction = (params: ContractRecord) => Promise<{
  data: unknown[];
  meta?: { pageCount?: number; scope?: string; totalCount?: number };
}>;

export interface ScopedRowsRequest {
  /** Server list action. Receives `scope` beside the usual list parameters. */
  list?: ListAction;
  /** Local rows, used when there is no list action. */
  rows?: readonly unknown[];
  params?: ContractRecord;
  scope?: ListScope;
  pageSize?: number;
  /** Rows kept at most; views show that the result was truncated. */
  maxRows?: number;
  /** `throw` for views that are wrong when incomplete, such as a planning graph. */
  overflow?: "throw" | "truncate";
  signal?: AbortSignal;
}

export interface ScopedRowsResult {
  rows: Record<string, unknown>[];
  truncated: boolean;
  /** `server` when the list action confirmed it applied the scope with `meta.scope: "applied"`. */
  scopeApplied: "client" | "none" | "server";
}

export class ScopedRowsOverflowError extends Error {
  constructor(maxRows: number) {
    super(`More than ${maxRows} rows match. Narrow the filters and try again.`);
    this.name = "ScopedRowsOverflowError";
  }
}

export const DEFAULT_SCOPED_PAGE_SIZE = 100;
export const DEFAULT_SCOPED_MAX_ROWS = 2000;
const MAX_SCOPED_PAGES = 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value: number) => String(value).padStart(2, "0");

/** The local calendar day of a date value, matching the date filters' day semantics. */
export function localDayKey(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return value;
  }
  const date =
    value instanceof Date || typeof value === "number"
      ? new Date(value)
      : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    return;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function rowInBounds(
  row: Record<string, unknown>,
  scope: BoundsScope
): boolean {
  const location = parseLocation(row[scope.field]);
  const bounds = normalizeBounds(scope);
  return Boolean(location && bounds && boundsContain(bounds, location));
}

export function rowInScope(
  row: Record<string, unknown>,
  scope: ListScope
): boolean {
  if (scope.kind === "bbox") {
    return rowInBounds(row, scope);
  }
  const start = localDayKey(row[scope.field]);
  if (!start) {
    return false;
  }
  const end =
    (scope.endField ? localDayKey(row[scope.endField]) : undefined) ?? start;
  return start <= scope.to && end >= scope.from;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function capRows(
  rows: Record<string, unknown>[],
  maxRows: number,
  overflow: "throw" | "truncate"
): { rows: Record<string, unknown>[]; truncated: boolean } {
  if (rows.length <= maxRows) {
    return { rows, truncated: false };
  }
  if (overflow === "throw") {
    throw new ScopedRowsOverflowError(maxRows);
  }
  return { rows: rows.slice(0, maxRows), truncated: true };
}

function isLastPage(
  batch: number,
  meta: { pageCount?: number; totalCount?: number } | undefined,
  page: number,
  loaded: number,
  pageSize: number
): boolean {
  const pageCount = Number(meta?.pageCount);
  const totalCount = Number(meta?.totalCount);
  if (Number.isFinite(pageCount) && pageCount > 0) {
    return page >= pageCount;
  }
  if (Number.isFinite(totalCount) && totalCount >= 0) {
    return loaded >= totalCount;
  }
  return batch < pageSize;
}

function appliedBy(
  scope: ListScope | undefined,
  serverScoped: boolean
): ScopedRowsResult["scopeApplied"] {
  if (!scope) {
    return "none";
  }
  return serverScoped ? "server" : "client";
}

/**
 * Load every row a view needs, not only the current page.
 *
 * The scope is sent to the list action; a server that filters by it answers
 * `meta.scope: "applied"`. Otherwise rows are filtered here, so hosts that have
 * not implemented scopes keep working, only with more data transferred.
 */
export async function loadScopedRows({
  list,
  rows,
  params = {},
  scope,
  pageSize = DEFAULT_SCOPED_PAGE_SIZE,
  maxRows = DEFAULT_SCOPED_MAX_ROWS,
  overflow = "truncate",
  signal,
}: ScopedRowsRequest): Promise<ScopedRowsResult> {
  const keep = (row: unknown): row is Record<string, unknown> =>
    isRecord(row) && (!scope || rowInScope(row, scope));
  if (!list) {
    return {
      ...capRows((rows ?? []).filter(keep), maxRows, overflow),
      scopeApplied: appliedBy(scope, false),
    };
  }

  const request = compatibleListParams({ ...params, pageSize });
  const collected: Record<string, unknown>[] = [];
  let loaded = 0;
  let serverScoped = false;
  for (let page = 1; page <= MAX_SCOPED_PAGES; page += 1) {
    signal?.throwIfAborted();
    const result = await list({
      ...request,
      ...(scope ? { scope } : {}),
      page,
    });
    signal?.throwIfAborted();
    if (page === 1) {
      serverScoped = Boolean(scope) && result.meta?.scope === "applied";
    }
    const batch = result.data ?? [];
    loaded += batch.length;
    collected.push(...batch.filter(serverScoped ? isRecord : keep));
    const done =
      batch.length === 0 ||
      isLastPage(batch.length, result.meta, page, loaded, pageSize);
    // Stop early once the cap is exceeded; the caller only needs to know it was.
    if (done || collected.length > maxRows) {
      return {
        ...capRows(collected, maxRows, overflow),
        scopeApplied: appliedBy(scope, serverScoped),
      };
    }
  }
  throw new Error(
    "Too many pages to load all matching rows. Narrow the filters and try again."
  );
}
