"use client";

import { useCallback, useMemo } from "react";
import type { TableConfig } from "../../../config/helpers";
import type { TableActions } from "../../../providers/table-provider";
import {
  matchesContractFilter,
  normalizeFilterEnvelope,
} from "../../../utils/table-contracts";
import { DataTable } from "../../data-table";
import type {
  FieldValues,
  FormConfigContext,
  FormFieldApi,
  TablePickerFieldDefinition,
} from "../types";

type PickerRow = Record<string, unknown>;

const selectedFieldValues = (value: unknown, multiple: boolean): unknown[] => {
  if (multiple) {
    return Array.isArray(value) ? value : [];
  }
  return value === undefined || value === null ? [] : [value];
};

const toggledRowSelection = ({
  id,
  multiple,
  rowSelection,
}: {
  id: string;
  multiple: boolean;
  rowSelection: Record<string, boolean>;
}): Record<string, boolean> => {
  if (multiple) {
    return { ...rowSelection, [id]: !rowSelection[id] };
  }
  return rowSelection[id] ? {} : { [id]: true };
};

const comparableValue = (value: unknown): number | string => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return String(value ?? "").toLocaleLowerCase();
};

const columnValue = (
  config: TableConfig,
  row: PickerRow,
  columnId: string
): unknown => {
  const column = config.columns.definitions.find(
    (definition) => definition.id === columnId
  );
  const accessor = column?.accessorFn;
  if (typeof accessor === "function") {
    return (accessor as (record: PickerRow) => unknown)(row);
  }
  const accessorKey =
    typeof column?.accessorKey === "string" ? column.accessorKey : columnId;
  return row[accessorKey];
};

const matchesSimpleFilter = (actual: unknown, expected: unknown): boolean => {
  const normalizedExpected = String(expected ?? "").toLocaleLowerCase();
  if (Array.isArray(actual)) {
    return actual.some((item) =>
      String(item).toLocaleLowerCase().includes(normalizedExpected)
    );
  }
  return String(actual ?? "")
    .toLocaleLowerCase()
    .includes(normalizedExpected);
};

/** Apply the same local list contract used by a server-backed nested table. */
export const queryTablePickerRows = ({
  config,
  params,
  rows,
}: {
  config: TableConfig;
  params: Record<string, unknown>;
  rows: PickerRow[];
}): { data: PickerRow[]; meta: { pageCount: number; totalCount: number } } => {
  const search = String(params.search ?? params.q ?? params.globalSearch ?? "")
    .trim()
    .toLocaleLowerCase();
  const filters =
    params.filters && typeof params.filters === "object"
      ? (params.filters as Record<string, unknown>)
      : {};
  const advanced = normalizeFilterEnvelope(params.advancedFilters);
  const sorting = Array.isArray(params.sorting)
    ? (params.sorting as Array<{ desc?: boolean; id: string }>)
    : [];

  const filtered = rows.filter((row) => {
    if (
      search &&
      !config.columns.definitions.some((column) =>
        String(columnValue(config, row, column.id) ?? "")
          .toLocaleLowerCase()
          .includes(search)
      )
    ) {
      return false;
    }
    if (
      !Object.entries(filters).every(([columnId, expected]) =>
        matchesSimpleFilter(columnValue(config, row, columnId), expected)
      )
    ) {
      return false;
    }
    const activeAdvancedFilters = advanced.filters.filter(
      (filter) => filter.isActive !== false
    );
    if (activeAdvancedFilters.length === 0) {
      return true;
    }
    const matches = (filter: Record<string, unknown>) =>
      matchesContractFilter(
        columnValue(config, row, String(filter.columnId)),
        filter
      );
    return advanced.joinOperator === "or"
      ? activeAdvancedFilters.some(matches)
      : activeAdvancedFilters.every(matches);
  });
  const sorted =
    sorting.length === 0
      ? filtered
      : [...filtered].sort((leftRow, rightRow) => {
          for (const sort of sorting) {
            const left = comparableValue(columnValue(config, leftRow, sort.id));
            const right = comparableValue(
              columnValue(config, rightRow, sort.id)
            );
            if (left === right) {
              continue;
            }
            const comparison = left < right ? -1 : 1;
            return sort.desc ? -comparison : comparison;
          }
          return 0;
        });
  const pageSize = Math.max(1, Number(params.pageSize ?? params.limit ?? 10));
  const page = Math.max(1, Number(params.page ?? 1));
  const totalCount = sorted.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (page - 1) * pageSize;
  return {
    data: sorted.slice(start, start + pageSize),
    meta: { pageCount, totalCount },
  };
};

export function TablePickerField<
  TFieldValues extends FieldValues = FieldValues,
>({
  context,
  field,
  fieldApi,
}: {
  context: FormConfigContext<TFieldValues>;
  field: TablePickerFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<unknown>;
}) {
  const picker = field.tablePicker;
  const disabled = field.disabled === true;
  const sourceConfig =
    typeof picker.config === "function"
      ? picker.config(context)
      : picker.config;
  const localRows =
    typeof picker.data === "function"
      ? picker.data(context)
      : (picker.data ?? []);
  const nestedConfig = useMemo<TableConfig>(() => {
    const canSelectRow = sourceConfig.table.canSelectRow;
    return {
      ...sourceConfig,
      table: {
        ...sourceConfig.table,
        allowBulkDelete: false,
        allowBulkEdit: false,
        allowCreate: false,
        allowDelete: false,
        allowDuplicate: false,
        allowEdit: false,
        allowInlineEdit: false,
        bulkExport: false,
        canSelectRow: disabled ? () => false : canSelectRow,
        enableMultiRowSelection: picker.multiple !== false,
        enableRowSelection: true,
        export: false,
        preserveSelectionOnQuery: true,
        rowClickMode:
          disabled || picker.selectOnRowClick === false ? "none" : "activate",
        syncUrl: picker.syncUrl ?? false,
      },
    };
  }, [
    disabled,
    picker.multiple,
    picker.selectOnRowClick,
    picker.syncUrl,
    sourceConfig,
  ]);
  const resolvedActions =
    typeof picker.actions === "function"
      ? picker.actions(context)
      : picker.actions;
  const tableActions = useMemo<TableActions | undefined>(() => {
    if (resolvedActions) {
      return {
        aggregate: resolvedActions.aggregate,
        list: resolvedActions.list,
        views: resolvedActions.views,
      };
    }
    if (!picker.data) {
      return undefined;
    }
    return {
      list: async (params) =>
        queryTablePickerRows({ config: nestedConfig, params, rows: localRows }),
    };
  }, [localRows, nestedConfig, picker.data, resolvedActions]);
  const currentValues = useMemo(
    () => selectedFieldValues(fieldApi.state.value, picker.multiple !== false),
    [fieldApi.state.value, picker.multiple]
  );
  const rowSelection = useMemo(
    () =>
      Object.fromEntries(
        currentValues.map((value) => [String(value), true] as const)
      ),
    [currentValues]
  );
  const parseValue = useCallback(
    (id: string): unknown => picker.parseValue?.(id) ?? id,
    [picker]
  );
  const updateSelection = useCallback(
    (next: Record<string, boolean>) => {
      if (disabled) {
        return;
      }
      const active = Object.keys(next).filter((id) => next[id]);
      if (picker.multiple === false) {
        const current = currentValues[0];
        const selected =
          active.find((id) => id !== String(current)) ?? active[0];
        fieldApi.handleChange(
          selected === undefined ? null : parseValue(selected)
        );
        return;
      }
      const activeSet = new Set(active);
      const previous = currentValues
        .map(String)
        .filter((id) => activeSet.delete(id));
      fieldApi.handleChange([...previous, ...activeSet].map(parseValue));
    },
    [currentValues, disabled, fieldApi, parseValue, picker.multiple]
  );
  const getRowId = useCallback(
    (row: PickerRow): string => {
      if (picker.getRowId) {
        return picker.getRowId(row);
      }
      const value = row.id ?? row._id ?? row.key;
      return String(value ?? "");
    },
    [picker]
  );
  const activateRow = useCallback(
    (row: PickerRow) => {
      if (disabled || picker.selectOnRowClick === false) {
        return;
      }
      const id = getRowId(row);
      if (!id || nestedConfig.table.canSelectRow?.(row) === false) {
        return;
      }
      updateSelection(
        toggledRowSelection({
          id,
          multiple: picker.multiple !== false,
          rowSelection,
        })
      );
    },
    [
      disabled,
      getRowId,
      nestedConfig.table,
      picker.multiple,
      picker.selectOnRowClick,
      rowSelection,
      updateSelection,
    ]
  );
  const tableId = `${context.tableId}-${String(field.name)}-picker`;

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled}>
      <legend className="font-medium text-sm">{field.label}</legend>
      {field.description ? (
        <p className="text-muted-foreground text-sm">{field.description}</p>
      ) : null}
      <div
        className="overflow-auto rounded-md border p-2"
        style={picker.maxHeight ? { maxHeight: picker.maxHeight } : undefined}
      >
        <DataTable
          enableAdvancedFilters={nestedConfig.table.enableAdvancedFilters}
          enableViews={nestedConfig.table.enableViews}
          getRowId={getRowId}
          getTableActions={() => tableActions}
          getTableConfig={() => nestedConfig}
          initialActiveViewId={picker.initialActiveViewId}
          initialData={localRows}
          initialRowCount={localRows.length}
          initialViews={picker.initialViews}
          locale={picker.locale ?? context.locale}
          onRowActivate={activateRow}
          onRowSelectionStateChange={updateSelection}
          rowSelection={rowSelection}
          tableId={tableId}
          tableType={picker.tableType}
          translations={picker.translations ?? context.translations}
        />
      </div>
    </fieldset>
  );
}
