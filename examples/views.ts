/** Shared records and columns for the React and Vue view-switching examples and end-to-end tests. */
export const viewsRows = [
  ["alpha", "Alpha launch", "Software", "Active", 49, "2026-09-02"],
  ["bravo", "Bravo audit", "Service", "Draft", 120, "2026-09-05"],
  ["charlie", "Charlie display", "Hardware", "Active", 399, "2026-09-09"],
  ["delta", "Delta support", "Service", "Archived", 99, "2026-09-12"],
  ["echo", "Echo sensors", "Hardware", "Draft", 79, "2026-09-15"],
  ["foxtrot", "Foxtrot portal", "Software", "Active", 15, "2026-09-18"],
].map(([id, name, category, status, price, dueDate]) => ({
  id,
  name,
  category,
  status,
  price,
  dueDate,
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
  { id: "price", header: "Price", type: "number" as const },
  { id: "dueDate", header: "Due", type: "date" as const },
];

export const viewsTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  coloredTags: false,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "gallery", "kanban"] as (
    | "table"
    | "gallery"
    | "kanban"
  )[],
  kanban: { groupBy: "status" },
  gallery: { titleColumn: "name", cardColumnIds: ["category", "status"] },
};
