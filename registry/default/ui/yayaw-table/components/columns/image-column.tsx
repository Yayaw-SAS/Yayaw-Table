"use client";

import { ImageIcon, type LucideIcon } from "lucide-react";
import type { CellContext, ColumnDef } from "../../tanstack";
import { ImageCell } from "../cells/image-cell";

interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

interface ImageColumnProps {
  accessorKey: string;
  className?: string;
  enableColumnFilter?: boolean;
  enableHiding?: boolean;
  enableSorting?: boolean;
  header?: string;
}

export function createImageColumn<TData>({
  accessorKey,
  className = "",
  enableColumnFilter = false,
  enableHiding = true,
  enableSorting = false,
  header,
}: ImageColumnProps): ExtendedColumnDef<TData> {
  return {
    accessorKey,
    cell: (info: CellContext<TData, unknown>) => {
      const rowData = info.row.original as Record<string, unknown>;
      const label = typeof rowData.name === "string" ? rowData.name : undefined;

      return (
        <ImageCell
          alt={label ? `${label} image` : header}
          className={className}
          fallbackLabel={label}
          value={info.getValue()}
        />
      );
    },
    enableColumnFilter,
    enableGrouping: false,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: ImageIcon,
    id: accessorKey,
    type: "image",
  };
}
