import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultSortConfig,
  listRestockRows,
  withoutDefaultSort,
} from "./default-sort";

const actions = {
  list: listRestockRows,
  update: () => Promise.resolve({ success: true }),
};

/** `?example=default-sort`: the default order, as in the Vue demo. */
export function DefaultSortExample() {
  const config = useMemo(
    () => defineTableConfig(defaultSortConfig(!withoutDefaultSort())),
    []
  );
  return (
    <DataTable
      getRowId={(row) => String(row.id)}
      getTableActions={() => actions}
      getTableConfig={() => config}
      tableType={config.id}
    />
  );
}
