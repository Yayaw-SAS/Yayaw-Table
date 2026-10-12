"use client";

import type { CellContext, ColumnDef } from "@/components/ui/yayaw-table/tanstack";
import { ImageIcon, type LucideIcon } from "lucide-react";
import {
  type AvatarOption,
  avatarNameOf,
  resolveAvatarConfig,
} from "../../utils/initials-avatar";
import { ImageCell } from "../cells/image-cell";

interface CustomColumnProps {
  icon?: LucideIcon;
  type?: string;
}

type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

interface ImageColumnProps {
  accessorKey: string;
  /** Initials with a stable color for records without an image. */
  avatar?: AvatarOption;
  className?: string;
  enableColumnFilter?: boolean;
  enableHiding?: boolean;
  enableSorting?: boolean;
  header?: string;
}

export function createImageColumn<TData>({
  accessorKey,
  avatar,
  className = "",
  enableColumnFilter = false,
  enableHiding = true,
  enableSorting = false,
  header,
}: ImageColumnProps): ExtendedColumnDef<TData> {
  const avatarConfig = resolveAvatarConfig(avatar);
  return {
    accessorKey,
    cell: (info: CellContext<TData, unknown>) => {
      const rowData = info.row.original as Record<string, unknown>;
      const label = typeof rowData.name === "string" ? rowData.name : undefined;

      return (
        <ImageCell
          alt={label ? `${label} image` : header}
          avatarName={
            avatarConfig
              ? avatarNameOf(rowData, avatarConfig.nameColumn)
              : undefined
          }
          avatarShape={avatarConfig?.shape}
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
