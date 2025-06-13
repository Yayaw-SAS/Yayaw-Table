/**
 * Lazy loaded advanced filter components
 * These are only loaded when advanced filtering is actually used
 */
"use client"

import { lazy, Suspense } from "react"
import { Skeleton } from "../../../components/ui/skeleton"

// Lazy load the heavy advanced filter components
const AdvancedFacetedFilter = lazy(() => 
    import("./advanced-faceted-filter").then(mod => ({ 
        default: mod.AdvancedFacetedFilter 
    }))
)

const AdvancedFilterPanel = lazy(() => 
    import("./advanced-filter-panel").then(mod => ({ 
        default: mod.AdvancedFilterPanel 
    }))
)

const FilterPresetsPanel = lazy(() => 
    import("./filter-presets-panel").then(mod => ({ 
        default: mod.FilterPresetsPanel 
    }))
)

const ModernAddFilterDropdown = lazy(() => 
    import("./modern-add-filter-dropdown").then(mod => ({ 
        default: mod.ModernAddFilterDropdown 
    }))
)

// Skeleton loaders for each component
const FilterSkeleton = () => (
    <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
    </div>
)

const PanelSkeleton = () => (
    <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
        </div>
    </div>
)

// Exported lazy components with suspense boundaries
export function LazyAdvancedFacetedFilter(props: any) {
    return (
        <Suspense fallback={<FilterSkeleton />}>
            <AdvancedFacetedFilter {...props} />
        </Suspense>
    )
}

export function LazyAdvancedFilterPanel(props: any) {
    return (
        <Suspense fallback={<PanelSkeleton />}>
            <AdvancedFilterPanel {...props} />
        </Suspense>
    )
}

export function LazyFilterPresetsPanel(props: any) {
    return (
        <Suspense fallback={<PanelSkeleton />}>
            <FilterPresetsPanel {...props} />
        </Suspense>
    )
}

export function LazyModernAddFilterDropdown(props: any) {
    return (
        <Suspense fallback={<Skeleton className="h-9 w-24" />}>
            <ModernAddFilterDropdown {...props} />
        </Suspense>
    )
}

// Export types for convenience (commented out until available)
// export type { AdvancedFacetedFilterProps } from "./advanced-faceted-filter"
// export type { AdvancedFilterPanelProps } from "./advanced-filter-panel"
// export type { FilterPresetsPanelProps } from "./filter-presets-panel"