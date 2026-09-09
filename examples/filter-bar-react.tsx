"use client";

import { useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

const rows = [
  { id: "1", name: "Atlas", category: 0, tags: ["Tech"], active: false },
  { id: "2", name: "Beacon", category: 2, tags: ["News"], active: true },
  {
    id: "3",
    name: "Current",
    category: 4,
    tags: ["Tech", "News"],
    active: true,
  },
];
const config = defineTableConfig({
  id: "filter-bar-demo",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: 0, label: "Web" },
          { value: 2, label: "Print" },
          { value: 4, label: "TV" },
        ],
      },
      {
        id: "tags",
        header: "Tags",
        type: "multiSelect",
        options: [
          { value: "Tech", label: "Tech" },
          { value: "News", label: "News" },
        ],
      },
      { id: "active", header: "Active", type: "boolean" },
    ],
    mandatory: ["name"],
    visible: ["name", "category", "tags", "active"],
    order: ["name", "category", "tags", "active"],
  },
  table: {
    filterBarColumns: ["category", "tags", "active"],
    showFilterBar: true,
    showClearFilters: true,
    syncUrl: false,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowDuplicate: false,
  },
  translations: {
    namespace: "demo",
    keys: {
      title: "Media filters",
      description: "Fictional records for the filter-bar example.",
    },
  },
});
const actions: TableActions = {
  list: (request) => {
    const filters = (request.filters ?? {}) as Record<string, unknown>;
    const data = rows.filter((row) =>
      Object.entries(filters).every(([id, value]) => {
        const selected = Array.isArray(value) ? value : [value];
        const cell = row[id as keyof typeof row];
        return selected.some((item) =>
          Array.isArray(cell)
            ? cell.some((candidate) => candidate === item)
            : cell === item
        );
      })
    );
    return Promise.resolve({
      data,
      meta: { totalCount: data.length, pageCount: 1 },
    });
  },
};
const getConfig = () => config;
const getActions = () => actions;

/** Mount inside NuqsAdapter and a shared QueryClientProvider. Visibility belongs to the host preference, not a saved table view. */
export function FilterBarExample() {
  const [visible, setVisible] = useState(true);
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
          type="checkbox"
        />
        Show filter bar
      </label>
      <DataTable
        getTableActions={getActions}
        getTableConfig={getConfig}
        initialData={rows}
        showFilterBar={visible}
        tableType="filter-bar-demo"
      />
    </div>
  );
}
