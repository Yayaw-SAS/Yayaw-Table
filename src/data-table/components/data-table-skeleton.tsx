/**
 * Skeleton loader for the DataTable component
 * Displayed while the client component is loading
 */
import { Skeleton } from '@/components/ui/skeleton';

// Generate stable IDs for skeleton items to avoid array index keys
const HEADER_ITEMS = Array.from({ length: 5 }, (_, index) => ({
  id: `header-skeleton-${index + 1}`,
}));

const ROW_ITEMS = Array.from({ length: 5 }, (_item, rowIndex) => {
  const rowId = rowIndex + 1;
  return {
    id: `row-skeleton-${rowId}`,
    cells: Array.from({ length: 5 }, (_cell, colIndex) => ({
      id: `row-${rowId}-cell-${colIndex + 1}`,
    })),
  };
});

/**
 * Skeleton component for the DataTable
 * Shows a loading placeholder while the actual table is being loaded
 */
export function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* Header */}
        <div className="border-b bg-muted/50 p-4">
          <div className="flex items-center space-x-4">
            {HEADER_ITEMS.map((header) => (
              <Skeleton className="h-6 w-[120px]" key={header.id} />
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y">
          {ROW_ITEMS.map((row) => (
            <div className="p-4" key={row.id}>
              <div className="flex items-center space-x-4">
                {row.cells.map((cell) => (
                  <Skeleton className="h-5 w-[120px]" key={cell.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[150px]" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
