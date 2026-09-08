"use client";

import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

const rows = Array.from({ length: 100 }, (_, index) => ({
  id: String(index + 1),
  name: `Product ${index + 1}`,
  status: index % 2 ? "Active" : "Draft",
}));
const config = defineTableConfig({
  id: "automatic-pagination",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "text" },
    ],
    visible: ["name", "status"],
    mandatory: ["name"],
    order: ["select", "name", "status"],
  },
  table: {
    enableAutoPageSize: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50],
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowDuplicate: false,
    syncUrl: false,
  },
  translations: {
    namespace: "automatic-pagination",
    keys: {
      title: "Automatic pagination",
      description:
        "Choose Automatic, then resize the viewport or change the row density.",
    },
  },
});
const actions: TableActions = {
  list: (request) => {
    const size = Number(request.pageSize ?? request.limit ?? 10);
    const page = Number(request.page ?? 1);
    return Promise.resolve({
      data: rows.slice((page - 1) * size, page * size),
      meta: {
        pageCount: Math.ceil(rows.length / size),
        totalCount: rows.length,
      },
    });
  },
};

/** Render inside NuqsAdapter and a shared QueryClientProvider; the server receives an ordinary positive numeric page size. */
export function AutomaticPaginationExample() {
  return (
    <DataTable
      getTableActions={() => actions}
      getTableConfig={() => config}
      initialData={rows.slice(0, 10)}
      initialPageCount={10}
      initialRowCount={rows.length}
      tableType="automatic-pagination"
    />
  );
}
