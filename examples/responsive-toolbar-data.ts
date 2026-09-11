import {
  compatibleListParams,
  matchesContractFilter,
  normalizeFilterEnvelope,
  positiveInteger,
  recordValue,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

export interface ToolbarRow extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  price: number;
  active: boolean;
}

function matchesColumnFilter(actual: unknown, value: unknown): boolean {
  if (
    value == null ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  ) {
    return true;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(recordValue(value)).every(([operator, expected]) =>
      matchesContractFilter(actual, { operator, values: expected })
    );
  }
  return matchesContractFilter(actual, {
    operator:
      typeof actual === "string" && !Array.isArray(value)
        ? "contains"
        : "isAnyOf",
    values: value,
  });
}

/** Demo list endpoint: apply the same request contract as a remote data source. */
export function queryToolbarRows(
  rows: readonly ToolbarRow[],
  input: Record<string, unknown>
) {
  const params = compatibleListParams(input);
  const search = String(params.search).trim().toLocaleLowerCase();
  const advanced = normalizeFilterEnvelope(params.advancedFilters);
  const filtered = rows.filter((row) => {
    const matchesSearch =
      !search ||
      [row.name, row.status, row.price, row.active].some((value) =>
        String(value).toLocaleLowerCase().includes(search)
      );
    const matchesColumns = Object.entries(recordValue(params.filters)).every(
      ([id, value]) => matchesColumnFilter(row[id], value)
    );
    const matchesRule = (filter: Record<string, unknown>) =>
      matchesContractFilter(row[String(filter.columnId)], filter);
    const matchesAdvanced =
      !advanced.filters.length ||
      (params.advancedFilterJoin === "or"
        ? advanced.filters.some(matchesRule)
        : advanced.filters.every(matchesRule));
    return matchesSearch && matchesColumns && matchesAdvanced;
  });
  const sorts = Object.entries(recordValue(params.orderBy));
  const sorted = filtered.sort((left, right) => {
    for (const [id, direction] of sorts) {
      const a = left[id],
        b = right[id];
      const comparison =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a ?? "").localeCompare(String(b ?? ""), undefined, {
              numeric: true,
            });
      if (comparison) {
        return direction === "desc" ? -comparison : comparison;
      }
    }
    return 0;
  });
  const pageSize = positiveInteger(params.pageSize, 10);
  const offset = (positiveInteger(params.page, 1) - 1) * pageSize;
  return {
    data: sorted.slice(offset, offset + pageSize),
    meta: {
      totalCount: sorted.length,
      pageCount: Math.ceil(sorted.length / pageSize),
    },
  };
}
