/**
 * Pagination sans Select Radix pour éviter les boucles infinies
 * Utilise des boutons simples à la place
 */
'use client';

import type { Table } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTableTranslations } from '../hooks';

interface SafePaginationProps<TData> {
  table: Table<TData>;
  rowCount?: number;
  className?: string;
}

export function SafePagination<TData>({
  table,
  rowCount,
  className,
}: SafePaginationProps<TData>) {
  const translations = useTableTranslations();

  // Get pagination state
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  // Calculate display info
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min(
    (pageIndex + 1) * pageSize,
    rowCount || table.getRowModel().rows.length
  );

  // Page size options
  const pageSizeOptions = [5, 10, 20, 30, 50];

  // Handle page size change with buttons instead of Select
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      console.log(
        '🔧 SafePagination: Changing page size from',
        pageSize,
        'to',
        newSize
      );
      console.log('🔧 SafePagination state:', {
        pageIndex,
        pageSize,
        pageCount,
        rowCount,
        startRow,
        endRow,
        totalRows: table.getRowModel().rows.length,
      });
      if (newSize === pageSize) return; // Prevent unnecessary updates
      table.setPageSize(newSize);
    },
    [table, pageSize]
  );

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-4 py-4 sm:flex-row',
        className
      )}
    >
      {/* Row range display */}
      <div className="flex-1 text-muted-foreground text-sm">
        {startRow}-{endRow} {translations.of}{' '}
        {rowCount ?? table.getRowModel().rows.length}
      </div>

      {/* Page size selector with buttons */}
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{translations.rowsPerPage}</p>
        <div className="flex gap-1">
          {pageSizeOptions.map((size) => (
            <Button
              className="h-8 w-10 p-0"
              key={size}
              onClick={() => handlePageSizeChange(size)}
              size="sm"
              type="button"
              variant={size === pageSize ? 'default' : 'outline'}
            >
              {size}
            </Button>
          ))}
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

        <div className="flex items-center gap-1 text-sm">
          <span>Page</span>
          <span className="font-medium">{pageIndex + 1}</span>
          <span>of</span>
          <span className="font-medium">{pageCount}</span>
        </div>

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
  );
}
