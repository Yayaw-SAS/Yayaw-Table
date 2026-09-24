import { useMemo } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultSortConfig,
  initialRestockPage,
  listRestockRows,
  listRestockRowsLater,
  withoutDefaultSort,
} from "./default-sort";

// `&initial=…`: the host's first page shows while the list answers.
const firstPage = initialRestockPage();
const actions = {
  list: firstPage ? listRestockRowsLater : listRestockRows,
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
      initialData={firstPage?.initialData}
      initialDataSort={firstPage?.initialDataSort}
      initialPageCount={firstPage?.initialPageCount}
      initialRowCount={firstPage?.initialRowCount}
      tableType={config.id}
    />
  );
}
