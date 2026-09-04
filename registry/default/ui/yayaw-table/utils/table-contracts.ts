/** Framework-independent adapters. Also copied into the standalone Vue registry. */
export type ContractRecord = Record<string, unknown>;

export function recordValue(value: unknown): ContractRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ContractRecord)
    : {};
}

/** Read both historical arrays and the Vue filter envelope without losing OR semantics. */
export function normalizeFilterEnvelope(value: unknown): {
  filters: ContractRecord[];
  joinOperator: "and" | "or";
} {
  const envelope = recordValue(value);
  const candidates = Array.isArray(value) ? value : envelope.filters;
  const filters = Array.isArray(candidates)
    ? candidates
        .map(recordValue)
        .filter(
          (filter) =>
            typeof filter.columnId === "string" &&
            typeof filter.operator === "string"
        )
    : [];
  const joinOperator =
    envelope.joinOperator === "or" || filters[0]?.joinOperator === "or"
      ? "or"
      : "and";
  return {
    filters: filters.map((filter) => ({
      ...filter,
      isActive: filter.isActive !== false,
      ...(joinOperator === "or" ? { joinOperator } : {}),
    })),
    joinOperator,
  };
}

/** Supply both editions' existing list parameter names to unchanged application handlers. */
export function compatibleListParams(input: ContractRecord): ContractRecord {
  const pageSize = positiveInteger(input.pageSize ?? input.limit, 10);
  const sorting = Array.isArray(input.sorting)
    ? input.sorting
    : Object.entries(recordValue(input.orderBy)).map(([id, direction]) => ({
        id,
        desc: direction === "desc",
      }));
  const orderBy = Object.fromEntries(
    sorting.map((item) => {
      const sort = recordValue(item);
      return [String(sort.id), sort.desc ? "desc" : "asc"];
    })
  );
  const search = String(input.search ?? input.q ?? input.globalSearch ?? "");
  const advanced = normalizeFilterEnvelope(input.advancedFilters);
  return {
    ...input,
    page: positiveInteger(input.page, 1),
    limit: pageSize,
    pageSize,
    orderBy,
    sorting,
    search,
    q: search,
    globalSearch: search,
    filters: recordValue(input.filters),
    advancedFilters: advanced.filters.filter(
      (filter) => filter.isActive !== false
    ),
    advancedFilterJoin: input.advancedFilterJoin ?? advanced.joinOperator,
    grouping: Array.isArray(input.grouping) ? input.grouping : [],
  };
}

export function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.trunc(number))
    : fallback;
}

/** Collect every result using the server's pagination metadata, including capped page sizes. */
export async function fetchAllContractRows<T>({
  list,
  params,
  maxPages = 1000,
}: {
  list: (params: ContractRecord) => Promise<{
    data: T[];
    meta?: { pageCount?: number; totalCount?: number };
  }>;
  params: ContractRecord;
  maxPages?: number;
}): Promise<T[]> {
  const request = compatibleListParams(params);
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await list({ ...request, page });
    rows.push(...result.data);
    const pageCount = result.meta?.pageCount;
    const totalCount = result.meta?.totalCount;
    const hasPageCount = Number.isFinite(pageCount) && (pageCount ?? 0) > 0;
    const hasTotalCount =
      Number.isFinite(totalCount) && (totalCount ?? -1) >= 0;
    if (
      (hasPageCount && page >= (pageCount ?? 0)) ||
      (hasTotalCount && rows.length >= (totalCount ?? 0)) ||
      (!(hasPageCount || hasTotalCount) &&
        result.data.length < Number(request.pageSize))
    ) {
      return rows;
    }
    if (!result.data.length) {
      throw new Error(
        "The list action returned an empty page before all matching rows were loaded."
      );
    }
  }
  throw new Error(
    "Too many pages to load all matching rows. Narrow the filters and try again."
  );
}

/** Canonical saved-view names are React's; legacy Vue names remain readable. */
export function normalizeViewAliases(value: unknown): ContractRecord {
  const view = recordValue(value);
  return {
    ...view,
    columnFilters: view.columnFilters ?? view.filters ?? [],
    globalSearch: view.globalSearch ?? view.search ?? "",
    columnPinning: view.columnPinning ??
      view.pinning ?? { left: [], right: [] },
    grouping:
      view.grouping ??
      (recordValue(view.kanban).groupBy
        ? [recordValue(view.kanban).groupBy]
        : []),
  };
}

/** Match the shared operators before either framework renders the filtered rows. */
export function matchesContractFilter(
  actual: unknown,
  filter: ContractRecord
): boolean {
  const values = Array.isArray(filter.values) ? filter.values : [filter.values];
  const items = Array.isArray(actual) ? actual : [actual];
  const empty =
    actual == null ||
    actual === "" ||
    (Array.isArray(actual) && !actual.length);
  if (filter.type === "date") {
    return matchesDateFilter(actual, filter.operator, values);
  }
  if (filter.operator === "isEmpty") {
    return empty;
  }
  if (filter.operator === "isNotEmpty") {
    return !empty;
  }
  if (
    [
      "greaterThan",
      "greaterThanOrEqual",
      "lessThan",
      "lessThanOrEqual",
      "between",
    ].includes(String(filter.operator))
  ) {
    return (
      !empty &&
      matchesNumberFilter(
        Number(actual),
        String(filter.operator),
        values.map(Number)
      )
    );
  }
  const textual = ["text", "string"].includes(String(filter.type));
  const text = String(actual ?? "").toLocaleLowerCase();
  const expected = String(values[0] ?? "").toLocaleLowerCase();
  const contains = (item: unknown) =>
    items.some((value) => String(value) === String(item));
  switch (filter.operator) {
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false;
    case "is":
    case "equals":
      return textual ? text === expected : values.some(contains);
    case "isNot":
    case "notEquals":
      return textual ? text !== expected : !values.some(contains);
    case "isAnyOf":
    case "in":
      return values.some(contains);
    case "isNoneOf":
    case "notIn":
    case "containsNone":
      return !values.some(contains);
    case "containsAll":
      return values.every(contains);
    case "contains":
      return Array.isArray(actual)
        ? values.some(contains)
        : text.includes(expected);
    case "notContains":
      return Array.isArray(actual)
        ? !values.some(contains)
        : !text.includes(expected);
    case "startsWith":
      return text.startsWith(expected);
    case "endsWith":
      return text.endsWith(expected);
    default:
      return true;
  }
}

function matchesDateFilter(
  actual: unknown,
  operator: unknown,
  values: unknown[]
): boolean {
  const date = (input: unknown) =>
    input instanceof Date || typeof input === "number"
      ? new Date(input)
      : new Date(String(input ?? ""));
  const value = date(actual);
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    const valid = Number.isFinite(value.getTime());
    return operator === "isEmpty" ? !valid : valid;
  }
  const start = date(values[0]);
  if (!(Number.isFinite(value.getTime()) && Number.isFinite(start.getTime()))) {
    return false;
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  switch (operator) {
    case "equals":
      return value >= start && value <= end;
    case "notEquals":
      return value < start || value > end;
    case "before":
    case "lessThan":
      return value < start;
    case "after":
    case "greaterThan":
      return value > end;
    case "greaterThanOrEqual":
      return value >= start;
    case "lessThanOrEqual":
      return value <= end;
    case "between": {
      const last = date(values[1] ?? values[0]);
      if (last < start) {
        const first = new Date(last);
        first.setHours(0, 0, 0, 0);
        return value >= first && value <= end;
      }
      last.setHours(23, 59, 59, 999);
      return value >= start && value <= last;
    }
    default:
      return true;
  }
}

function matchesNumberFilter(
  actual: number,
  operator: string,
  values: number[]
): boolean {
  switch (operator) {
    case "greaterThan":
      return actual > (values[0] ?? Number.NaN);
    case "greaterThanOrEqual":
      return actual >= (values[0] ?? Number.NaN);
    case "lessThan":
      return actual < (values[0] ?? Number.NaN);
    case "lessThanOrEqual":
      return actual <= (values[0] ?? Number.NaN);
    default:
      return (
        actual >= (values[0] ?? Number.NaN) &&
        actual <= (values[1] ?? Number.NaN)
      );
  }
}
