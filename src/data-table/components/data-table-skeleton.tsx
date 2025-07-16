/**
 * Skeleton loader for the DataTable component
 * Displayed while the client component is loading
 */
import { Skeleton } from '@/components/ui/skeleton'

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
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton className="h-6 w-[120px]" key={i} />
                        ))}
                    </div>
                </div>

                {/* Rows */}
                <div className="divide-y">
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                        <div className="p-4" key={rowIndex}>
                            <div className="flex items-center space-x-4">
                                {Array.from({ length: 5 }).map((_, colIndex) => (
                                    <Skeleton className="h-5 w-[120px]" key={colIndex} />
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
    )
}
