/**
 * Location column: a place `{ lat, lng, label?, address? }` shown with a pin
 * and its name, address or coordinates.
 */
"use client";

import { MapPin } from "lucide-react";
import type {
  CellContext,
  ColumnDef,
} from "@/components/ui/yayaw-table/tanstack";
import { LocationCell } from "../cells/location-cell";

interface LocationColumnProps {
  accessorKey: string;
  enableHiding?: boolean;
  enableSorting?: boolean;
  enableColumnFilter?: boolean;
  header?: string;
}

/** Creates a location column definition. */
export function createLocationColumn<TData>({
  accessorKey,
  enableHiding = true,
  enableSorting = false,
  enableColumnFilter = true,
  header,
}: LocationColumnProps): ColumnDef<TData> & { icon: typeof MapPin; type: string } {
  return {
    accessorKey,
    cell: (info: CellContext<TData, unknown>) => (
      <LocationCell value={info.getValue()} />
    ),
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header: header || accessorKey,
    icon: MapPin,
    id: accessorKey,
    type: "location",
  };
}
