import { dataTypeColumns, dataTypeRow } from "../../../examples/data-types";
import { DataTable } from "../../../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../../../src/components/ui/yayaw-table/config/helpers";

// Internal inspection fixture: values are static; only the filter UI is audited.
const config = defineTableConfig({
  id: "submenu-type-audit",
  columns: {
    definitions: dataTypeColumns,
    order: dataTypeColumns.map((column) => column.id),
    visible: ["text", "number", "boolean", "date", "multiSelectValue"],
    mandatory: [],
  },
  table: { enableAdvancedFilters: true, syncUrl: false },
  translations: { namespace: "audit", keys: { title: "All filter types" } },
});
const getConfig = () => config;
const rows = [dataTypeRow];
const actions = {
  list: async () => ({ data: rows, meta: { pageCount: 1, totalCount: 1 } }),
};
const getActions = () => actions;
export function TypeAudit() {
  return (
    <DataTable
      getTableActions={getActions}
      getTableConfig={getConfig}
      initialData={rows}
      tableType={config.id}
    />
  );
}
