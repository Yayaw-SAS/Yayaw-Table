/**
 * Dynamic type column component for data tables
 * Renders values differently based on a specified type column
 */
"use client";

import type { CellContext, ColumnDef } from "@/components/ui/yayaw-table/tanstack";
import { type LucideIcon, Shapes } from "lucide-react";
import { memo, type ReactNode, useCallback, useMemo } from "react";

// Import necessary components
import { useTableTranslations } from "../../hooks";
import { BooleanCell } from "../cells/boolean-cell";
import { JsonCell } from "../cells/json-cell";
import { NumberCell } from "../cells/number-cell";
import { StringCell } from "../cells/string-cell";

/**
 * Custom properties for our column definitions
 */
interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

interface DynamicTypeColumnProps<_TData> {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Optional custom renderers for specific types
   */
  customRenderers?: Record<string, (value: unknown) => ReactNode>;

  /**
   * Whether to enable hiding this column
   */
  enableHiding?: boolean;

  /**
   * Whether to enable sorting for this column
   */
  enableSorting?: boolean;

  /**
   * Optional custom header text
   */
  header?: string;

  /**
   * The key for the type column that determines how to render the value
   */
  typeKey: string;

  /**
   * The key for the value column
   */
  valueKey: string;
}

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

/**
 * Creates a column that dynamically renders values based on a type column
 */
export function createDynamicTypeColumn<TData>({
  className = "",
  customRenderers = {},
  enableHiding = true,
  enableSorting = false,
  header,
  typeKey,
  valueKey,
}: DynamicTypeColumnProps<TData>): ExtendedColumnDef<TData> {
  return {
    accessorKey: valueKey,
    cell: (info: CellContext<TData, unknown>) => {
      // Create a proper React component to use hooks
      // Define as an inner memoized component to prevent unnecessary renders
      const MemoizedDynamicCellRenderer = memo(function DynamicCellRenderer() {
        // Use hooks inside the component
        const _translations = useTableTranslations();

        // Extract values only once and memoize the calculation
        const { processedValue, valueType } = useMemo(() => {
          let value = info.getValue();
          const cellValueType = info.row.getValue(typeKey) as string;

          // Handle Prisma JSON objects with 'set' property
          if (value && typeof value === "object" && "set" in value) {
            value = (value as { set: unknown }).set;
          }

          return { processedValue: value, valueType: cellValueType };
        }, []);

        // Handle null, undefined, or NaN values - memoize this decision
        const isEmptyValue = useMemo(() => {
          return (
            processedValue === null ||
            processedValue === undefined ||
            (typeof processedValue === "number" && Number.isNaN(processedValue))
          );
        }, [processedValue]);

        // Helper function to render empty values
        const renderEmptyValue = useCallback(() => {
          return <span className="text-muted-foreground">-</span>;
        }, []);

        // Helper function to render custom content
        const renderCustomContent = useCallback(
          (renderer: (val: unknown) => ReactNode, cellValue: unknown) => {
            return <>{renderer(cellValue)}</>;
          },
          []
        );

        // Helper function to render typed content
        const renderTypedContent = useCallback(
          (type: string, value: unknown) => {
            switch (type) {
              case "boolean":
                return <BooleanCell value={Boolean(value)} />;
              case "json":
                return <JsonCell value={value} />;
              case "number":
                return (
                  <NumberCell
                    value={typeof value === "number" ? value : Number(value)}
                  />
                );
              case "options":
              case "string":
                return <StringCell value={value} />;
              default:
                return (
                  <span className={className}>
                    {value === null || value === undefined ? "" : String(value)}
                  </span>
                );
            }
          },
          []
        );

        // Memoize the content to render based on value type and empty state
        const content = useMemo(() => {
          // First handle empty values
          if (isEmptyValue) {
            return renderEmptyValue();
          }

          // Check if there's a custom renderer for this type
          if (customRenderers[valueType]) {
            return renderCustomContent(
              customRenderers[valueType],
              processedValue
            );
          }

          // Format based on valueType
          return renderTypedContent(valueType, processedValue);
        }, [
          valueType,
          processedValue,
          isEmptyValue,
          renderEmptyValue,
          renderCustomContent,
          renderTypedContent,
        ]);

        return content;
      });

      // Return the memoized cell renderer component
      return <MemoizedDynamicCellRenderer />;
    },
    enableHiding,
    enableSorting,
    header: header || valueKey,
    icon: Shapes,
    id: valueKey,
    type: "dynamic",
  };
}
