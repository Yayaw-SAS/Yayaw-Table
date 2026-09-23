/** Shared records and columns for the React and Vue view-switching examples and end-to-end tests. */
export const viewsRows = [
  ["alpha", "Alpha launch", "Software", "Active", 49, "2026-09-02"],
  ["bravo", "Bravo audit", "Service", "Draft", 120, "2026-09-05"],
  ["charlie", "Charlie display", "Hardware", "Active", 399, "2026-09-09"],
  ["delta", "Delta support", "Service", "Archived", 99, "2026-09-12"],
  ["echo", "Echo sensors", "Hardware", "Draft", 79, "2026-09-15"],
  ["foxtrot", "Foxtrot portal", "Software", "Active", 15, "2026-09-18"],
].map(([id, name, category, status, price, dueDate]) => ({
  id: String(id),
  name: String(name),
  category: String(category),
  status: String(status),
  price: Number(price),
  progress: (Number(price) % 100) / 100,
  dueDate: String(dueDate),
}));

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

export const viewsColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Software", "Hardware", "Service"]),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Active", "Draft", "Archived"]),
  },
  {
    id: "price",
    header: "Price",
    type: "number" as const,
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
  {
    id: "progress",
    header: "Progress",
    type: "number" as const,
    numberFormat: { style: "percent" as const, display: "bar" as const },
  },
  { id: "dueDate", header: "Due", type: "date" as const },
];

export const viewsTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  manualOrder: true,
  coloredTags: false,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list", "gallery", "kanban"] as (
    | "table"
    | "list"
    | "gallery"
    | "kanban"
  )[],
  kanban: { groupBy: "status" },
  gallery: { titleColumn: "name", cardColumnIds: ["category", "status"] },
  list: { titleColumn: "name", cardColumnIds: ["status", "price", "dueDate"] },
};

/**
 * In-memory host for the examples: `list` pages through the rows and applies
 * each view's own manual order; `reorder` stores it without touching records.
 */
export function createViewsActions() {
  const orders = new Map<string, string[]>();
  const keyOf = (viewId: unknown) => String(viewId ?? "default");
  const ordered = (viewId: unknown) => {
    const order = orders.get(keyOf(viewId));
    if (!order) {
      return viewsRows;
    }
    const position = new Map(order.map((id, index) => [id, index]));
    return [...viewsRows].sort(
      (left, right) =>
        (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (position.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  };
  return {
    list: (params: Record<string, unknown>) => {
      const sorting = Array.isArray(params.sorting) ? params.sorting : [];
      const manual = sorting.some(
        (sort: { id?: string }) => sort?.id === "__manual"
      );
      const rows = manual ? ordered(params.viewId) : viewsRows;
      return Promise.resolve({
        data: rows,
        meta: { pageCount: 1, totalCount: rows.length },
      });
    },
    reorder: (move: {
      viewId: string | null;
      id: string;
      previousId?: string;
      nextId?: string;
    }) => {
      const ids = ordered(move.viewId)
        .map((row) => row.id)
        .filter((id) => id !== move.id);
      const index = move.previousId ? ids.indexOf(move.previousId) + 1 : 0;
      ids.splice(index, 0, move.id);
      orders.set(keyOf(move.viewId), ids);
      return Promise.resolve({ success: true });
    },
  };
}
