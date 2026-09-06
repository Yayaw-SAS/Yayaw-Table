/**
 * Pagination with native select to avoid Radix feedback loops
 */
"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { type ReactNode, type Ref, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTableTranslations } from "../hooks";
import type { Table } from "../tanstack";

interface SafePaginationProps<TData> {
  containerRef?: Ref<HTMLDivElement>;
  controlsRef?: Ref<HTMLDivElement>;
  table: Table<TData>;
  rowCount?: number;
  className?: string;
  footerSlot?: ReactNode;
  pageSizeOptions?: number[];
  showControls?: boolean;
}

export function SafePagination<TData>({
  containerRef,
  controlsRef,
  table,
  rowCount,
  className,
  footerSlot,
  pageSizeOptions = [10, 20, 50, 100, 200, 500],
  showControls = true,
}: SafePaginationProps<TData>) {
  const translations = useTableTranslations();

  // Get pagination state
  const { pageIndex, pageSize } = table.store.state.pagination;
  const pageCount = table.getPageCount();

  // Calculate display info
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min(
    (pageIndex + 1) * pageSize,
    rowCount || table.getRowModel().rows.length
  );

  const normalizedPageSizeOptions = [...new Set(pageSizeOptions)]
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((a, b) => a - b);
  const availablePageSizes = normalizedPageSizeOptions.includes(pageSize)
    ? normalizedPageSizeOptions
    : [...normalizedPageSizeOptions, pageSize].sort((a, b) => a - b);

  // Handle page size change
  const handlePageSizeChange = useCallback(
    (newSize: string) => {
      const parsedSize = Number.parseInt(newSize, 10);
      if (Number.isNaN(parsedSize)) {
        return;
      }

      const current = table.store.state.pagination.pageSize;
      if (parsedSize === current) {
        return;
      }

      table.setPageSize(parsedSize);
    },
    [table]
  );

  const hasFooterSlot = footerSlot != null;
  if (!(showControls || hasFooterSlot)) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-col gap-4 py-4", className)}
      ref={containerRef}
    >
      {hasFooterSlot ? (
        <div className="flex w-full justify-center">{footerSlot}</div>
      ) : null}

      {showControls ? (
        <div
          className="flex flex-col items-center justify-between gap-4 sm:flex-row"
          ref={controlsRef}
        >
          {/* Row range display */}
          <div className="flex-1 text-muted-foreground text-sm">
            {startRow}-{endRow} {translations.of}{" "}
            {rowCount ?? table.getRowModel().rows.length}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{translations.rowsPerPage}</p>
            <div className="relative">
              <select
                aria-label={translations.rowsPerPage}
                className="h-8 min-w-20 appearance-none rounded-md border bg-background py-1.5 pr-8 pl-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onChange={(event) => handlePageSizeChange(event.target.value)}
                value={pageSize.toString()}
              >
                {availablePageSizes.map((size) => (
                  <option key={size} value={size.toString()}>
                    {size}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <Button
              aria-label={translations.firstPage}
              className="h-8 w-8"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.setPageIndex(0)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              aria-label={translations.previousPage}
              className="h-8 w-8"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm">
              {translations.format("pageXofY", {
                page: pageIndex + 1,
                total: pageCount || 1,
              })}
            </span>

            <Button
              aria-label={translations.nextPage}
              className="h-8 w-8"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              aria-label={translations.lastPage}
              className="h-8 w-8"
              disabled={!table.getCanNextPage()}
              onClick={() => table.setPageIndex(pageCount - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
