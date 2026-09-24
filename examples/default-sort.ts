/**
 * Default order parity: the same rows, list handler and config in both demos
 * (`?example=default-sort`). The rows are stored neither by id nor by date,
 * and the handler, like a server, orders by `orderBy` and then by id. With
 * `columns.sort` configured every mode starts sorted by it; with
 * `&sort=none` no sort is sent and the list order is kept.
 */

export interface RestockRow extends Record<string, unknown> {
  id: string;
  name: string;
  restockFrom: string;
  restockTo: string;
  status: string;
}

const ROWS: RestockRow[] = [
  {
    id: "desk",
    name: "Desk",
    restockFrom: "2026-09-14",
    restockTo: "2026-09-18",
    status: "active",
  },
  {
    id: "lamp",
    name: "Lamp",
    restockFrom: "2026-09-17",
    restockTo: "2026-09-24",
    status: "draft",
  },
  {
    id: "chair",
    name: "Chair",
    restockFrom: "2026-09-23",
    restockTo: "2026-10-02",
    status: "active",
  },
];

const compareText = (left: unknown, right: unknown): number =>
  String(left ?? "").localeCompare(String(right ?? ""));

/** A server-like list: `orderBy` first, then the id, one page at a time. */
export function listRestockRows(params: Record<string, unknown>) {
  const orderBy = Object.entries(
    (params.orderBy ?? {}) as Record<string, string>
  );
  const rows = [...ROWS].sort((left, right) => {
    for (const [id, direction] of orderBy) {
      const comparison = compareText(left[id], right[id]);
      if (comparison) {
        return direction === "desc" ? -comparison : comparison;
      }
    }
    return compareText(left.id, right.id);
  });
  const pageSize = Math.max(1, Number(params.pageSize) || rows.length);
  const page = Math.max(1, Number(params.page) || 1);
  return Promise.resolve({
    data: rows
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => ({ ...row })),
    meta: {
      pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
      totalCount: rows.length,
    },
  });
}

/** Whether the page asks for the table without a configured sort. */
export const withoutDefaultSort = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sort") === "none";

/** The table config both editions pass to `defineTableConfig`. */
export function defaultSortConfig(configuredSort: boolean) {
  return {
    id: "restock",
    columns: {
      definitions: [
        { id: "name", header: "Product", type: "text" as const },
        { id: "restockFrom", header: "From", type: "date" as const },
        { id: "restockTo", header: "To", type: "date" as const },
        {
          id: "status",
          header: "Status",
          type: "select" as const,
          options: [
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
          ],
        },
      ],
      order: ["name", "restockFrom", "restockTo", "status"],
      visible: ["name", "restockFrom", "restockTo", "status"],
      mandatory: ["name"],
      sort: configuredSort ? [{ id: "restockFrom", desc: false }] : [],
    },
    table: {
      displayModes: ["table", "gantt", "kanban", "gallery"] as (
        | "table"
        | "gantt"
        | "kanban"
        | "gallery"
      )[],
      defaultDisplayMode: "table" as const,
      kanban: { groupBy: "status", titleColumn: "name" },
      gallery: { titleColumn: "name" },
      enableViews: false,
      allowCreate: false,
      allowDelete: false,
      allowDuplicate: false,
      planning: {
        enabled: true,
        scopeId: "restock",
        sourceId: "products",
      },
      gantt: {
        titleColumn: "name",
        startColumn: "restockFrom",
        endColumn: "restockTo",
      },
      defaultPageSize: 10,
    },
    translations: {
      namespace: "restock",
      keys: {
        title: "Restock plan",
        description: "The same rows and list handler in React and Vue.",
      },
    },
  };
}
