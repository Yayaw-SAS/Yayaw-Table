/**
 * One table started from a favorite view, for the React and Vue server
 * rendering tests: Ann's records, sorted by name descending, three per page.
 */
export const CREATED_AT = "2026-01-01T23:30:00Z";
export const TIME_ZONE = "Asia/Tokyo";

export const serverRenderingRecords = Array.from(
  { length: 12 },
  (_, index) => ({
    id: String(index + 1),
    name: `Record ${index + 1}`,
    owner: index % 2 ? "ann" : "bob",
    amount: index,
    tags: ["urgent"],
    createdAt: CREATED_AT,
  })
);

export const serverRenderingColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "owner",
    header: "Owner",
    type: "select" as const,
    options: ["ann", "bob"].map((value) => ({ label: value, value })),
  },
  {
    id: "amount",
    header: "Amount",
    type: "number" as const,
    defaultCalculation: "sum" as const,
  },
  {
    id: "createdAt",
    header: "Created",
    type: "date" as const,
    dateDisplayPreset: "dateTime" as const,
  },
];

export const favoriteView = {
  id: "mine",
  tableId: "ssr",
  name: "Mine",
  config: {
    columnFilters: [{ id: "owner", value: ["ann"] }],
    globalSearch: "Record",
    sorting: [{ id: "name", desc: true }],
    pageSize: 3,
  },
};

/** The host's list: owners from the column filter, names descending. */
export function listServerRenderingRecords(params: Record<string, unknown>) {
  const owners = (params.filters as Record<string, string[]> | undefined)
    ?.owner;
  const matching = serverRenderingRecords
    .filter((row) => !owners || owners.includes(row.owner))
    .sort((left, right) =>
      right.name.localeCompare(left.name, "en", { numeric: true })
    );
  const pageSize = Number(params.pageSize ?? params.limit);
  const start = (Number(params.page) - 1) * pageSize;
  return {
    data: matching.slice(start, start + pageSize),
    meta: {
      pageCount: Math.ceil(matching.length / pageSize),
      totalCount: matching.length,
    },
  };
}
