/** Shared records and column contracts keep the two interactive examples comparable. */
export const presentationRows = [
  {
    id: "one",
    name: "Workspace Pro",
    category: "Software",
    status: "Active",
    price: 49,
    active: true,
    createdAt: "2026-09-01",
    description: "A shared workspace for product teams.",
  },
  {
    id: "two",
    name: "Studio Display",
    category: "Hardware",
    status: "Draft",
    price: 399,
    active: false,
    createdAt: "2026-09-08",
    description: "A display for the design studio.",
  },
  {
    id: "three",
    name: "Team Support",
    category: "Service",
    status: "Active",
    price: 99,
    active: true,
    createdAt: "2026-09-12",
    description: "Dedicated support for your team.",
  },
];
export const presentationColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    options: ["Software", "Hardware", "Service"].map((value) => ({
      value,
      label: value,
    })),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    options: ["Active", "Draft", "Archived"].map((value) => ({
      value,
      label: value,
    })),
  },
  { id: "price", header: "Price", type: "number" as const },
  { id: "active", header: "Available", type: "boolean" as const },
  { id: "createdAt", header: "Created", type: "date" as const },
  { id: "description", header: "Description", type: "text" as const },
];

/** Explicit catalogue contract also enables Vue's field-based bulk editor. */
export const presentationForm = {
  id: "record-presentation",
  submitMode: "patch" as const,
  fields: presentationColumns.map((column) => ({
    name: column.id,
    label: column.header,
    type: column.type === "boolean" ? ("switch" as const) : column.type,
    options: column.options,
  })),
};
