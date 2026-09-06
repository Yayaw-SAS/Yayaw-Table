/**
 * Footer row that displays column calculations.
 * Each visible column gets a CalculationMenu cell.
 * Reads column definitions from the table config to pass
 * `defaultCalculation` and `enableCalculation` per column.
 */
"use client";

import type { Table } from "@tanstack/react-table";
import { type CSSProperties, memo, useMemo } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useGlobalColumnCalculations } from "../../hooks/use-global-column-calculations";
import { useTableConfig } from "../../hooks/use-table-config";
import type { CalculationType } from "../../types/footer-types";
import { isCalculationValidForColumn } from "../../types/footer-types";
import { CalculationMenu } from "./calculation-menu";

interface FooterRowProps<TData> {
  densityMode: "small" | "medium" | "large";
  table: Table<TData>;
  tableId: string;
  tableType: string;
}

const isNumberColumnDef = (def: {
  type?: string;
  meta?: { columnType?: string };
}): boolean => def.type === "number" || def.meta?.columnType === "number";

const getColumnType = (def: {
  type?: string;
  meta?: { columnType?: string };
}): string | undefined =>
  (def.type as string) || (def.meta?.columnType as string) || undefined;

const getFixedColumnPaddingClass = (
  densityMode: "small" | "medium" | "large"
): string => {
  if (densityMode === "small") {
    return "!px-1.5";
  }
  if (densityMode === "large") {
    return "!px-3";
  }
  return "px-2";
};

function FooterRowBase<TData>({
  densityMode,
  table,
  tableId,
  tableType,
}: FooterRowProps<TData>) {
  const isSmallDensity = densityMode === "small";
  const isLargeDensity = densityMode === "large";
  const fixedColumnPaddingClass = getFixedColumnPaddingClass(densityMode);

  const { config: tableConfig } = useTableConfig(tableType);

  const columnDefMap = useMemo(() => {
    const map: Record<
      string,
      {
        defaultCalculation?: string;
        enableCalculation?: boolean;
        type?: string;
      }
    > = {};
    for (const def of tableConfig.columns.definitions) {
      map[def.id] = {
        defaultCalculation: def.defaultCalculation,
        enableCalculation: def.enableCalculation,
        type: def.type,
      };
    }
    return map;
  }, [tableConfig.columns.definitions]);

  const visibleColumns = table.getVisibleLeafColumns();
  const visibleColumnIds = useMemo(
    () =>
      visibleColumns
        .map((column) => column.id)
        .filter((id) => id !== "select" && id !== "actions"),
    [visibleColumns]
  );

  const {
    hasAnyCalculation,
    isLoading: isCalculationsLoading,
    resultsByColumn,
  } = useGlobalColumnCalculations({
    tableId,
    tableType,
    columnDefinitions: tableConfig.columns.definitions,
    columnIds: visibleColumnIds,
  });

  const firstCalculableColumnId = useMemo(() => {
    const firstCalculableColumn = visibleColumns.find((column) => {
      if (column.id === "select" || column.id === "actions") {
        return false;
      }

      const configDef = columnDefMap[column.id];
      return configDef?.enableCalculation !== false;
    });

    return firstCalculableColumn?.id;
  }, [columnDefMap, visibleColumns]);

  const cellSizeStyle = (
    column: (typeof visibleColumns)[number]
  ): CSSProperties | undefined => {
    const def = column.columnDef;
    const isFixed = column.id === "select" || column.id === "actions";
    const isResizable = table.options.enableColumnResizing === true;
    const hasExplicitSizing =
      typeof (def as { size?: number }).size === "number" ||
      typeof (def as { minSize?: number }).minSize === "number" ||
      typeof (def as { maxSize?: number }).maxSize === "number";

    if (!(isFixed || hasExplicitSizing || isResizable)) {
      return undefined;
    }

    const style: CSSProperties = {};
    const size = column.getSize();

    if (
      isFixed ||
      isResizable ||
      typeof (def as { size?: number }).size === "number"
    ) {
      style.width = size;
    }
    if (isFixed || isResizable) {
      style.minWidth = size;
    } else if (typeof (def as { minSize?: number }).minSize === "number") {
      style.minWidth = (def as { minSize: number }).minSize;
    }
    if (typeof (def as { maxSize?: number }).maxSize === "number") {
      style.maxWidth = (def as { maxSize: number }).maxSize;
    }
    return style;
  };

  return (
    <TableRow
      className={cn(
        "border-t border-b-0 bg-card hover:bg-card [&>td:first-child]:rounded-bl-md [&>td:last-child]:rounded-br-md",
        isSmallDensity && "[&_td]:!h-7 [&_td]:!py-0",
        isLargeDensity && "[&_td]:!h-10 [&_td]:!py-1"
      )}
    >
      {visibleColumns.map((column) => {
        const isSelect = column.id === "select";
        const isActions = column.id === "actions";
        const isFixed = isSelect || isActions;

        if (isFixed) {
          return (
            <TableCell
              className={cn(
                "text-muted-foreground",
                isSelect &&
                  cn("select-column rounded-bl-md", fixedColumnPaddingClass),
                isActions &&
                  cn(
                    "sticky right-0 z-10 rounded-br-md bg-card shadow-[-1px_0_0_0_hsl(var(--border))]",
                    fixedColumnPaddingClass
                  )
              )}
              key={column.id}
              style={cellSizeStyle(column)}
            >
              {null}
            </TableCell>
          );
        }

        const def = column.columnDef;
        const colType = getColumnType(def);
        const numCol = isNumberColumnDef(def);

        const configDef = columnDefMap[column.id];
        const enableCalc = configDef?.enableCalculation !== false;

        const rawDefault = configDef?.defaultCalculation as
          | CalculationType
          | undefined;
        const validDefault =
          rawDefault && isCalculationValidForColumn(rawDefault, colType)
            ? rawDefault
            : undefined;

        return (
          <TableCell
            className={cn(
              isSmallDensity && "!px-1.5",
              isLargeDensity && "!px-3",
              numCol && "text-right"
            )}
            key={column.id}
            style={cellSizeStyle(column)}
          >
            {enableCalc ? (
              <CalculationMenu
                columnId={column.id}
                columnType={colType}
                defaultCalculation={validDefault}
                isNumberColumn={numCol}
                isResultLoading={isCalculationsLoading}
                result={resultsByColumn[column.id]}
                showEmptyLabel={
                  !hasAnyCalculation && column.id === firstCalculableColumnId
                }
                tableId={tableId}
                tableType={tableType}
              />
            ) : null}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export const FooterRow = memo(FooterRowBase) as typeof FooterRowBase;
