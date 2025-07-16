import { flexRender, type Table as ReactTable } from '@tanstack/react-table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { cn } from '../../lib/utils';
import { useTranslations } from '../providers/table-provider';

interface SimpleDataTableProps<T> {
  table: ReactTable<T>;
  loading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
}

export function SimpleDataTable<T>({
  table,
  loading = false,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  className,
}: SimpleDataTableProps<T>) {
  const { t } = useTranslations();

  const rows = table.getRowModel().rows;
  const columns = table.getAllColumns();

  if (loading) {
    return <DataTableSkeleton />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      {onSearchChange && (
        <div className="flex items-center space-x-2">
          <Input
            className="max-w-sm"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || t('search.placeholder')}
            value={searchValue || ''}
          />

          {/* Selection Info */}
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center space-x-2 text-muted-foreground text-sm">
              <span>
                {t('selection.rows', {
                  count: table.getFilteredSelectedRowModel().rows.length,
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      'px-4 py-3',
                      header.column.getCanSort() &&
                        'cursor-pointer select-none hover:bg-muted/50'
                    )}
                    key={header.id}
                    onClick={
                      header.column.getCanSort()
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    <div className="flex items-center space-x-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}

                      {/* Sort indicator */}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground text-xs">
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? ' ↕'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  className="hover:bg-muted/50"
                  data-state={row.getIsSelected() && 'selected'}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="px-4 py-3" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <p className="text-muted-foreground">
                      {t('table.no_results')}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {t('table.no_results_description')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}

/**
 * Loading skeleton for the data table
 */
function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead key="skeleton-header-1">
                <Skeleton className="h-6 w-24" />
              </TableHead>
              <TableHead key="skeleton-header-2">
                <Skeleton className="h-6 w-24" />
              </TableHead>
              <TableHead key="skeleton-header-3">
                <Skeleton className="h-6 w-24" />
              </TableHead>
              <TableHead key="skeleton-header-4">
                <Skeleton className="h-6 w-24" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow key="skeleton-row-1">
              <TableCell key="skeleton-cell-1-1">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-1-2">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-1-3">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-1-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
            <TableRow key="skeleton-row-2">
              <TableCell key="skeleton-cell-2-1">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-2-2">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-2-3">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-2-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
            <TableRow key="skeleton-row-3">
              <TableCell key="skeleton-cell-3-1">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-3-2">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-3-3">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-3-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
            <TableRow key="skeleton-row-4">
              <TableCell key="skeleton-cell-4-1">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-4-2">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-4-3">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-4-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
            <TableRow key="skeleton-row-5">
              <TableCell key="skeleton-cell-5-1">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-5-2">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-5-3">
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell key="skeleton-cell-5-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Simple pagination component
 */
interface DataTablePaginationProps<T> {
  table: ReactTable<T>;
}

function DataTablePagination<T>({ table }: DataTablePaginationProps<T>) {
  const { t } = useTranslations();

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-muted-foreground text-sm">
        {t('pagination.showing', {
          page: table.getState().pagination.pageIndex + 1,
          total: table.getPageCount(),
        })}
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="font-medium text-sm">{t('pagination.rowsPerPage')}</p>
          <select
            className="h-8 w-16 rounded border border-input bg-background px-2 text-sm"
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            value={table.getState().pagination.pageSize}
          >
            {[5, 10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            {t('pagination.previous')}
          </Button>

          <div className="flex w-[120px] items-center justify-center font-medium text-sm">
            {t('pagination.page')} {table.getState().pagination.pageIndex + 1}{' '}
            {t('pagination.of')} {table.getPageCount()}
          </div>

          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
