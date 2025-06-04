import React from 'react'
import { flexRender, Table as ReactTable } from '@tanstack/react-table'
import { cn } from '../../lib/utils'
import { useTranslations } from '../providers/table-provider'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'

interface SimpleDataTableProps<T> {
  table: ReactTable<T>
  loading?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  className?: string
}

export function SimpleDataTable<T>({
  table,
  loading = false,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  className,
}: SimpleDataTableProps<T>) {
  const { t } = useTranslations()

  const rows = table.getRowModel().rows
  const columns = table.getAllColumns()

  if (loading) {
    return <DataTableSkeleton />
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      {onSearchChange && (
        <div className="flex items-center space-x-2">
          <Input
            placeholder={searchPlaceholder || t('search.placeholder')}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
          
          {/* Selection Info */}
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>
                {t('selection.rows', { 
                  count: table.getFilteredSelectedRowModel().rows.length 
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
                    key={header.id}
                    className={cn(
                      "px-4 py-3",
                      header.column.getCanSort() && "cursor-pointer select-none hover:bg-muted/50"
                    )}
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
                        <span className="text-xs text-muted-foreground">
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
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center space-y-2">
                    <p className="text-muted-foreground">
                      {t('table.no_results')}
                    </p>
                    <p className="text-sm text-muted-foreground">
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
  )
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
              {Array.from({ length: 4 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-6 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * Simple pagination component
 */
interface DataTablePaginationProps<T> {
  table: ReactTable<T>
}

function DataTablePagination<T>({ table }: DataTablePaginationProps<T>) {
  const { t } = useTranslations()

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex-1 text-sm text-muted-foreground">
        {t('pagination.showing', {
          page: table.getState().pagination.pageIndex + 1,
          total: table.getPageCount(),
        })}
      </div>
      
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{t('pagination.rowsPerPage')}</p>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value))
            }}
            className="h-8 w-16 rounded border border-input bg-background px-2 text-sm"
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
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('pagination.previous')}
          </Button>
          
          <div className="flex w-[120px] items-center justify-center text-sm font-medium">
            {t('pagination.page')} {table.getState().pagination.pageIndex + 1} {t('pagination.of')}{' '}
            {table.getPageCount()}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  )
} 