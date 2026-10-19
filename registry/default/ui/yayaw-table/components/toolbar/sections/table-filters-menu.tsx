"use client";

import { useFilterMenu } from "../../../hooks/use-filter-menu";
import { useTableConfig } from "../../../hooks/use-table-config";
import type { ColumnFiltersState } from "../../../tanstack";
import type { ColumnsFilterConfig } from "../../../types/filter-types";
import { StackMenuContent, StackMenuView } from "../../../ui-custom/stack-menu";
import { FilterPropertyPicker } from "../../filters/menu/filter-property-picker";

/**
 * The view settings' filter screen, as Notion's Filter: the properties
 * first; the new rule's chip then opens under the toolbar, the settings
 * closed.
 */
function SettingsFilterPicker({
  columnsConfig,
  onDone,
  tableId,
  tableType,
}: {
  columnsConfig: ColumnsFilterConfig;
  onDone?: () => void;
  tableId: string;
  tableType: string;
}) {
  const menu = useFilterMenu({ columnsConfig, tableId, tableType });
  return (
    <FilterPropertyPicker
      menu={menu}
      onAdvanced={() => {
        onDone?.();
        menu.openAdvanced();
      }}
      onPick={(columnId) => {
        onDone?.();
        menu.add(columnId);
      }}
    />
  );
}

export interface TableFiltersMenuProps {
  columnFilters: ColumnFiltersState;
  setColumnFilters: (state: ColumnFiltersState) => void;
  tableId: string;
  tableType?: string;
  advancedColumnsConfig?: ColumnsFilterConfig;
  useAdvancedFilters?: boolean;
  onDone?: () => void;
}

/** Settings and the visible add button open the same rule editor. */
export function TableFiltersMenu({
  columnFilters,
  setColumnFilters,
  tableId,
  tableType = tableId,
  advancedColumnsConfig,
  useAdvancedFilters = true,
  onDone,
}: TableFiltersMenuProps) {
  const { config } = useTableConfig(tableType);
  const customFilters = config.columns.definitions
    .filter(
      (column) => column.enableFiltering !== false && column.filterRenderer
    )
    .map((column) => (
      <div key={column.id}>
        {column.filterRenderer?.({
          value: columnFilters.find((filter) => filter.id === column.id)?.value,
          onChange: (value) => {
            const rest = columnFilters.filter(
              (filter) => filter.id !== column.id
            );
            setColumnFilters(
              value === undefined ||
                value === "" ||
                (Array.isArray(value) && !value.length)
                ? rest
                : [...rest, { id: column.id, value }]
            );
          },
        })}
      </div>
    ));
  return (
    <StackMenuView name="filters">
      <StackMenuContent>
        {customFilters}
        {useAdvancedFilters && (
          <SettingsFilterPicker
            columnsConfig={advancedColumnsConfig ?? {}}
            onDone={onDone}
            tableId={tableId}
            tableType={tableType}
          />
        )}
      </StackMenuContent>
    </StackMenuView>
  );
}
