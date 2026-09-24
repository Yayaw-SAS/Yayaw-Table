/**
 * Default order parity: the same rows, list handler and config in both demos
 * (`?example=default-sort`). The rows are stored neither by id nor by date,
 * and the handler, like a server, orders by `orderBy` and then by id. With
 * `columns.sort` configured every mode starts sorted by it; with
 * `&sort=none` no sort is sent and the list order is kept.
 *
 * With `&initial=list` or `&initial=sorted` the host also renders its first
 * page before the first request (`initialData`), in the list's own order or
 * in `columns.sort`, which it then names with `initialDataSort`. The list
 * answers after a moment, like a server.
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

/** The rows as the list orders them: by `orderBy`, then by id. */
function orderRestockRows(orderBy: Record<string, string>): RestockRow[] {
  const sorts = Object.entries(orderBy);
  return [...ROWS]
    .sort((left, right) => {
      for (const [id, direction] of sorts) {
        const comparison = compareText(left[id], right[id]);
        if (comparison) {
          return direction === "desc" ? -comparison : comparison;
        }
      }
      return compareText(left.id, right.id);
    })
    .map((row) => ({ ...row }));
}

/** A server-like list: `orderBy` first, then the id, one page at a time. */
export function listRestockRows(params: Record<string, unknown>) {
  const rows = orderRestockRows(
    (params.orderBy ?? {}) as Record<string, string>
  );
  const pageSize = Math.max(1, Number(params.pageSize) || rows.length);
  const page = Math.max(1, Number(params.page) || 1);
  return Promise.resolve({
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
      totalCount: rows.length,
    },
  });
}

/** How long the list takes when the host shows its own first page meanwhile. */
const LIST_DELAY_MS = 300;

/** `listRestockRows` answering after a moment, like a server. */
export const listRestockRowsLater = async (params: Record<string, unknown>) => {
  await new Promise((resolve) => setTimeout(resolve, LIST_DELAY_MS));
  return await listRestockRows(params);
};

/** Whether the page asks for the table without a configured sort. */
export const withoutDefaultSort = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sort") === "none";

/** The configured sort (`columns.sort`) unless the page asks for none. */
export const RESTOCK_SORT = [{ id: "restockFrom", desc: false }];

/** The first page a host renders before the first request. */
export interface RestockFirstPage {
  initialData: RestockRow[];
  /** Set when the host ordered the page by `columns.sort`. */
  initialDataSort?: { id: string; desc: boolean }[];
  initialPageCount: number;
  initialRowCount: number;
}

/**
 * The host's first page, in the list's own order (by id) or ordered by
 * `columns.sort`, which it then names with `initialDataSort`.
 */
export function restockFirstPage(sortedLikeTable: boolean): RestockFirstPage {
  const rows = orderRestockRows(
    sortedLikeTable
      ? Object.fromEntries(
          RESTOCK_SORT.map(({ desc, id }) => [id, desc ? "desc" : "asc"])
        )
      : {}
  );
  return {
    initialData: rows,
    ...(sortedLikeTable ? { initialDataSort: RESTOCK_SORT } : {}),
    initialPageCount: 1,
    initialRowCount: rows.length,
  };
}

/** `&initial=list` or `&initial=sorted`: the host's first page, if any. */
export function initialRestockPage(): RestockFirstPage | undefined {
  const mode =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("initial");
  if (mode !== "list" && mode !== "sorted") {
    return;
  }
  return restockFirstPage(mode === "sorted");
}

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
      sort: configuredSort ? RESTOCK_SORT.map((sort) => ({ ...sort })) : [],
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
