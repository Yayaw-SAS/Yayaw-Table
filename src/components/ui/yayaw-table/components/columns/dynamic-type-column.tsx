/**
 * Dynamic type column component for data tables
 * Renders values differently based on a specified type column
 */
"use client";

import type {
  CellContext,
  ColumnDef,
} from "@/components/ui/yayaw-table/tanstack";
import { type LucideIcon, Shapes } from "lucide-react";
import type { ReactNode } from "react";
import { DataTypeCell } from "../cells/data-type-cell";

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
    cell: (info: CellContext<TData, unknown>) => (
      <span className={className}>
        <DataTypeCell
          column={{
            id: valueKey,
            header: header ?? valueKey,
            type: "dynamicType",
            typeKey,
            customRenderers,
          }}
          row={info.row.original as Record<string, unknown>}
          value={info.getValue()}
        />
      </span>
    ),
    enableHiding,
    enableSorting,
    header: header || valueKey,
    icon: Shapes,
    id: valueKey,
    type: "dynamicType",
  };
}
