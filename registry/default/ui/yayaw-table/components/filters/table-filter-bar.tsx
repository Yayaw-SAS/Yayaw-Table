"use client";

import { useTableConfig } from "../../hooks/use-table-config";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import { filterBarColumns, replaceColumnFilter } from "../../utils/filter-bar";
import { OptionFilter } from "./option-filter";

export function TableFilterBar({
  tableId,
  tableType,
  visible = true,
}: {
  tableId: string;
  tableType: string;
  visible?: boolean;
}) {
  const { config } = useTableConfig(tableType);
  const state = useTableUrlState({
    tableId,
    enabled: config.table.syncUrl !== false,
  });
  const { t } = useTranslations();
  const columns = filterBarColumns(
    config.columns.definitions,
    config.table.filterBarColumns
  );
  if (!(visible && config.table.enableColumnFilters && columns.length)) {
    return null;
  }
  return (
    <fieldset
      aria-label={t("filters.title")}
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
    >
      {columns.map((column) => (
        <OptionFilter
          column={column}
          key={column.id}
          onChange={(values) => {
            state.setFiltersParam(
              replaceColumnFilter(state.filtersParam, column.id, values)
            );
            state.setPageParam("0");
          }}
          value={
            state.filtersParam.find((filter) => filter.id === column.id)?.value
          }
        />
      ))}
    </fieldset>
  );
}
