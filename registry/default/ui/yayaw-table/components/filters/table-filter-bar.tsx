"use client";

import { useAtomValue } from "jotai";
import { toolbarCompactAtom } from "../../atoms/table-atoms";
import { useTableConfig } from "../../hooks/use-table-config";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { AdvancedFiltersState } from "../../types";
import {
  filterBarColumns,
  filterBarDateValue,
  replaceColumnFilter,
  replaceFilterBarDateRule,
} from "../../utils/filter-bar";
import { FilterBarDate } from "./filter-bar-date";
import { OptionFilter } from "./option-filter";

export function TableFilterBar({
  tableId,
  tableType,
  visible = true,
  inMenu = false,
}: {
  tableId: string;
  tableType: string;
  visible?: boolean;
  inMenu?: boolean;
}) {
  const { config } = useTableConfig(tableType);
  const compact = useAtomValue(toolbarCompactAtom(tableId));
  const state = useTableUrlState({
    tableId,
    enabled: config.table.syncUrl !== false,
  });
  const { t } = useTranslations();
  const columns = filterBarColumns(
    config.columns.definitions,
    config.table.filterBarColumns
  );
  if (
    (!inMenu && compact) ||
    !visible ||
    !config.table.enableColumnFilters ||
    !columns.length
  ) {
    return null;
  }
  return (
    <fieldset
      aria-label={t("filters.title")}
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
    >
      {columns.map((column) =>
        column.type === "date" ? (
          <FilterBarDate
            column={column}
            key={column.id}
            onChange={(value) => {
              state.setAdvancedFiltersParam(
                replaceFilterBarDateRule(
                  state.advancedFiltersParam,
                  column.id,
                  value
                ) as AdvancedFiltersState
              );
              state.setPageParam("0");
            }}
            value={filterBarDateValue(state.advancedFiltersParam, column.id)}
          />
        ) : (
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
              state.filtersParam.find((filter) => filter.id === column.id)
                ?.value
            }
          />
        )
      )}
    </fieldset>
  );
}
