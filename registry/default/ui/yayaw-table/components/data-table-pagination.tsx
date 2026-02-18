/**
 * Pagination component for DataTable
 * Provides controls for navigating between pages
 */
"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Use static Select import; SSR-safe usage is handled by mounted state

import { cn } from "@/lib/utils";

import { useTableTranslations } from "../hooks";

interface DataTablePaginationProps<TData> {
  /**
   * Additional CSS classes for the pagination container
   */
  className?: string;

  /**
   * Total number of rows in the dataset
   */
  rowCount?: number;

  /**
   * Table instance from TanStack Table
   */
  table: Table<TData>;

  /**
   * Unique identifier for the table
   */
  tableId: string;
}

/**
 * Pagination component for DataTable
 * Provides controls for navigating between pages
 */
export function DataTablePagination<TData>({
  className,
  rowCount,
  table,
  tableId: _tableId,
}: DataTablePaginationProps<TData>) {
  // Get translations
  const translations = useTableTranslations();
  // Avoid hydration/compose-ref loops from Radix Select on first render
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get pagination state directly from table
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  // Calculate start and end row numbers for display
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min(
    (pageIndex + 1) * pageSize,
    rowCount || table.getRowModel().rows.length
  );

  // Handle page size change
  const handlePageSizeChange = useCallback(
    (value: string) => {
      const next = Number(value);
      if (Number.isNaN(next)) {
        return;
      }
      // Guard to avoid update loops if Radix re-fires onValueChange with same value
      const current = table.getState().pagination.pageSize;
      if (next === current) {
        return;
      }
      table.setPageSize(next);
    },
    [table]
  );

  // During SSR/first paint, render a simple static pagination to avoid Radix hydration refs
  if (!mounted) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-between gap-4 py-4 sm:flex-row",
          className
        )}
        suppressHydrationWarning
      >
        <div className="flex-1 text-muted-foreground text-sm">
          {startRow}-{endRow} {translations.of}{" "}
          {rowCount || table.getRowModel().rows.length}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{translations.rowsPerPage}</p>
          <div className="h-8 w-[70px] rounded border px-2 py-1 text-center text-sm">
            {pageSize}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-60">
          <span className="text-sm">
            {translations.format("pageXofY", {
              page: pageIndex + 1,
              total: pageCount || 1,
            })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 py-4 sm:flex-row",
        className
      )}
      suppressHydrationWarning
    >
      {/* Row range display */}
      <div className="flex-1 text-muted-foreground text-sm">
        {startRow}-{endRow} {translations.of}{" "}
        {rowCount || table.getRowModel().rows.length}
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{translations.rowsPerPage}</p>
        {mounted ? (
          <Select
            defaultValue={pageSize.toString()}
            key={`ps-${pageSize}-mounted`}
            onValueChange={(value) =>
              value != null && handlePageSizeChange(value)
            }
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="h-8 w-[70px] animate-pulse rounded bg-muted" />
        )}
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
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
