/**
 * Pagination component for DataTable
 * Provides controls for navigating between pages
 */
'use client';

import type { Table } from '@tanstack/react-table';
import { useAtom } from 'jotai';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { paginationAtom } from '../atoms/table-atoms';
import { useTableTranslations } from '../hooks';

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
  tableId,
}: DataTablePaginationProps<TData>) {
  // Get translations
  const translations = useTableTranslations();

  // Get pagination state from atom
  const [pagination, setPagination] = useAtom(paginationAtom(tableId));

  // Calculate row range for current page
  const { pageIndex, pageSize } = pagination;
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
      setPagination((prev) => ({
        ...prev,
        pageIndex: 0, // Reset to first page when changing page size
        pageSize: Number(value),
      }));
    },
    [setPagination]
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
        {rowCount || table.getRowModel().rows.length}
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{translations.rowsPerPage}</p>
        <Select
          onValueChange={handlePageSizeChange}
          value={pageSize.toString()}
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
          {translations.format('pageXofY', {
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
