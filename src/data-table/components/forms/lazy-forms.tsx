/**
 * Lazy loaded form components
 * Only the essential form container is lazy loaded for performance
 */
"use client"

import { lazy, Suspense } from "react"

// Lazy load the main form container
const CatalogueFormContainer = lazy(() => 
    import("./catalogue-form-container").then(mod => ({ 
        default: mod.CatalogueFormContainer 
    }))
)

// Skeleton loader for the form container
const ContainerSkeleton = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
            <div className="space-y-6 p-6">
                <div className="space-y-2">
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-10 w-full bg-muted animate-pulse rounded" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-10 w-full bg-muted animate-pulse rounded" />
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <div className="h-10 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-20 bg-muted animate-pulse rounded" />
                </div>
            </div>
        </div>
    </div>
)

// Export only the used lazy component
export function LazyCatalogueFormContainer(props: any) {
    return (
        <Suspense fallback={<ContainerSkeleton />}>
            <CatalogueFormContainer {...props} />
        </Suspense>
    )
}