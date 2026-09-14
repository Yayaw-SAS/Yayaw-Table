import {
  matchesContractFilter,
  normalizeFilterEnvelope,
} from "../utils/table-contracts";
import {
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  type TablePlanningConfig,
} from "./types";

export interface PlanningQuery {
  search?: string;
  filters?: { id: string; value: unknown }[];
  advancedFilters?: unknown;
  columns?: {
    id: string;
    accessorKey?: string;
    accessorFn?: (row: Record<string, unknown>) => unknown;
  }[];
}
/** Filters affect the projection only. The session always retains the complete scheduling graph. */
export function planningTaskMatches(
  task: PlanningTask,
  query: PlanningQuery
): boolean {
  const record = task.record ?? {
    name: task.label,
    start: task.start,
    end: task.end,
  };
  const valueFor = (id: string): unknown => {
    const column = query.columns?.find((item) => item.id === id);
    return column?.accessorFn
      ? column.accessorFn(record)
      : record[column?.accessorKey ?? id];
  };
  const search = query.search?.trim().toLocaleLowerCase();
  if (
    search &&
    ![task.label, ...Object.values(record)].some((value) =>
      String(value ?? "")
        .toLocaleLowerCase()
        .includes(search)
    )
  ) {
    return false;
  }
  if (
    query.filters?.some((filter) => {
      const actual = valueFor(filter.id);
      if (Array.isArray(filter.value)) {
        return !filter.value.some((item) =>
          (Array.isArray(actual) ? actual : [actual]).some(
            (value) => String(value) === String(item)
          )
        );
      }
      return !String(actual ?? "")
        .toLocaleLowerCase()
        .includes(String(filter.value ?? "").toLocaleLowerCase());
    })
  ) {
    return false;
  }
  const advanced = normalizeFilterEnvelope(query.advancedFilters);
  const filters = advanced.filters.filter(
    (filter) => filter.isActive !== false
  );
  if (!filters.length) {
    return true;
  }
  const matches = (filter: Record<string, unknown>): boolean =>
    matchesContractFilter(valueFor(String(filter.columnId)), filter);
  return advanced.joinOperator === "or"
    ? filters.some(matches)
    : filters.every(matches);
}

/** Reuse original records and restore missing ancestor context without adding filtered siblings. */
export function buildPlanningRows<T extends Record<string, unknown>>(
  rows: T[],
  snapshot: PlanningSnapshot | undefined,
  config: TablePlanningConfig | undefined,
  getId: (row: T) => string
): T[] {
  if (!config?.enabled || config.hierarchy === false || !snapshot) {
    return rows;
  }
  const tasks = new Map(
    snapshot.tasks
      .filter((task) => task.ref.source === config.sourceId)
      .map((task) => [task.ref.id, task])
  );
  const records = new Map<string, T>();
  const visit = (items: T[]): void => {
    for (const row of items) {
      records.set(getId(row), { ...row, subRows: [] });
      if (Array.isArray(row.subRows)) {
        visit(row.subRows as T[]);
      }
    }
  };
  visit(rows);
  for (const id of [...records.keys()]) {
    let parent = tasks.get(id)?.parent;
    const seen = new Set<string>();
    while (
      parent?.source === config.sourceId &&
      !seen.has(planningKey(parent))
    ) {
      seen.add(planningKey(parent));
      const task = tasks.get(parent.id);
      if (!task) {
        break;
      }
      if (!records.has(parent.id) && task.record) {
        records.set(parent.id, { ...task.record, subRows: [] } as unknown as T);
      }
      parent = task.parent;
    }
  }
  const roots: T[] = [];
  for (const [id, row] of records) {
    const task = tasks.get(id);
    const parent = task?.parent;
    const parentRow =
      parent?.source === config.sourceId && parent.id !== id
        ? records.get(parent.id)
        : undefined;
    if (parentRow) {
      (parentRow.subRows as T[]).push(row);
    } else {
      roots.push(row);
    }
  }
  return roots;
}

/** Sort siblings using the displayed column mappings; hierarchy order remains intact. */
export function comparePlanningTasks(
  a: PlanningTask,
  b: PlanningTask,
  query: PlanningQuery & { sorting: { id: string; desc: boolean }[] }
): number {
  for (const sort of query.sorting) {
    const column = query.columns?.find((item) => item.id === sort.id);
    const read = (task: PlanningTask): unknown =>
      column?.accessorFn
        ? column.accessorFn(task.record ?? {})
        : task.record?.[column?.accessorKey ?? sort.id];
    const left = read(a);
    const right = read(b);
    const difference =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left ?? "").localeCompare(String(right ?? ""), undefined, {
            numeric: true,
          });
    if (difference) {
      return sort.desc ? -difference : difference;
    }
  }
  return 0;
}
