/**
 * Advanced filters hook
 * Manages advanced filter state and provides actions for filter manipulation
 */

import { useCallback, useMemo, useState } from 'react'
import type {
    AdvancedFilterModel,
    AdvancedFilterPreset,
    AdvancedFiltersState,
    ColumnsFacetedData,
    ColumnsFilterConfig,
    FilterActions,
    FilterStrategy
} from '../types/filter-types'
import {
    applyFilters,
    convertToTanStackFilters,
    createFilter,
    generateFilterId,
    getFacetedDateRange,
    getFacetedNumericRange,
    getFacetedUniqueValues,
    updateFilter
} from '../utils/advanced-filters'

export interface UseAdvancedFiltersOptions<TData = Record<string, any>> {
    /** Filter strategy - client or server */
    strategy: FilterStrategy
    /** Data to filter (for client-side filtering) */
    data?: TData[]
    /** Column configurations */
    columnsConfig: ColumnsFilterConfig
    /** Column accessors for data extraction */
    accessors: Record<string, (row: TData) => any>
    /** Initial filters */
    defaultFilters?: AdvancedFiltersState
    /** Controlled filters state */
    filters?: AdvancedFiltersState
    /** Filters change callback */
    onFiltersChange?: (filters: AdvancedFiltersState) => void
    /** Pre-computed faceted data (for server-side filtering) */
    facetedData?: ColumnsFacetedData
    /** Auto-compute faceted data from data (for client-side filtering) */
    autoComputeFaceted?: boolean
    /** Debounce delay for filter changes */
    debounceMs?: number
}

export interface UseAdvancedFiltersReturn<TData = Record<string, any>> {
    /** Current filters state */
    filters: AdvancedFiltersState
    /** Filtered data (only for client-side filtering) */
    filteredData: TData[]
    /** Column configurations */
    columnsConfig: ColumnsFilterConfig
    /** Faceted data for columns */
    facetedData: ColumnsFacetedData
    /** Filter strategy */
    strategy: FilterStrategy
    /** Actions for managing filters */
    actions: FilterActions
    /** TanStack Table compatible filters */
    tanStackFilters: Array<{ id: string; value: any }>
    /** Active filters count */
    activeFiltersCount: number
    /** Whether any filters are applied */
    hasActiveFilters: boolean
}

/**
 * Hook for managing advanced filters
 */
export function useAdvancedFilters<TData = Record<string, any>>(
    options: UseAdvancedFiltersOptions<TData>
): UseAdvancedFiltersReturn<TData> {
    const {
        strategy,
        data = [],
        columnsConfig,
        accessors,
        defaultFilters = [],
        filters: controlledFilters,
        onFiltersChange,
        facetedData: providedFacetedData,
        autoComputeFaceted = true,
        debounceMs = 300
    } = options

    // Internal state for uncontrolled mode
    const [internalFilters, setInternalFilters] = useState<AdvancedFiltersState>(defaultFilters)

    // Use controlled or uncontrolled filters
    const filters = controlledFilters ?? internalFilters
    const setFilters = useCallback(
        (update: AdvancedFiltersState | ((prev: AdvancedFiltersState) => AdvancedFiltersState)) => {
            if (onFiltersChange) {
                const newFilters = typeof update === 'function' ? update(filters) : update
                onFiltersChange(newFilters)
            } else {
                setInternalFilters(update)
            }
        },
        [onFiltersChange, filters]
    )

    // Compute filtered data for client-side filtering
    const filteredData = useMemo(() => {
        if (strategy === 'server') {
            return data
        }

        return applyFilters(data, filters, accessors)
    }, [strategy, data, filters, accessors])

    // Compute faceted data for client-side filtering
    const computedFacetedData = useMemo(() => {
        if (!autoComputeFaceted || strategy === 'server' || !data.length) {
            return {}
        }

        const faceted: ColumnsFacetedData = {}

        Object.entries(columnsConfig).forEach(([columnId, config]) => {
            const accessor = accessors[columnId]
            if (!(accessor && config.faceted)) {
                return
            }

            switch (config.type) {
                case 'option':
                case 'multiOption': {
                    const uniqueValues = getFacetedUniqueValues(data, accessor)
                    faceted[columnId] = { uniqueValues }
                    break
                }
                case 'number': {
                    const range = getFacetedNumericRange(data, accessor)
                    if (range) {
                        faceted[columnId] = { range }
                    }
                    break
                }
                case 'date': {
                    const dateRange = getFacetedDateRange(data, accessor)
                    if (dateRange) {
                        faceted[columnId] = { dateRange }
                    }
                    break
                }
            }
        })

        return faceted
    }, [autoComputeFaceted, strategy, data, columnsConfig, accessors])

    // Use provided or computed faceted data
    const facetedData = providedFacetedData ?? computedFacetedData

    // Filter actions
    const actions: FilterActions = useMemo(() => {
        const addFilter = (
            filterData: Omit<AdvancedFilterModel, 'id' | 'createdAt' | 'updatedAt'>
        ) => {
            const newFilter = createFilter(
                filterData.columnId,
                filterData.type,
                filterData.operator,
                filterData.values,
                {
                    label: filterData.label,
                    isActive: filterData.isActive
                }
            )

            setFilters((prev) => [...prev, newFilter])
        }

        const updateFilterAction = (filterId: string, updates: Partial<AdvancedFilterModel>) => {
            setFilters((prev) =>
                prev.map((filter) =>
                    filter.id === filterId ? updateFilter(filter, updates) : filter
                )
            )
        }

        const removeFilter = (filterId: string) => {
            setFilters((prev) => prev.filter((filter) => filter.id !== filterId))
        }

        const clearFilters = () => {
            setFilters([])
        }

        const toggleFilter = (filterId: string) => {
            setFilters((prev) =>
                prev.map((filter) =>
                    filter.id === filterId
                        ? updateFilter(filter, { isActive: !filter.isActive })
                        : filter
                )
            )
        }

        const applyPreset = (preset: AdvancedFilterPreset) => {
            setFilters(preset.filters)
        }

        const savePreset = (name: string, description?: string): AdvancedFilterPreset => {
            const preset: AdvancedFilterPreset = {
                id: generateFilterId(),
                name,
                description,
                filters: [...filters],
                createdAt: new Date()
            }

            return preset
        }

        return {
            addFilter,
            updateFilter: updateFilterAction,
            removeFilter,
            clearFilters,
            toggleFilter,
            applyPreset,
            savePreset
        }
    }, [filters, setFilters])

    // Convert to TanStack Table format
    const tanStackFilters = useMemo(() => {
        return convertToTanStackFilters(filters)
    }, [filters])

    // Filter statistics
    const activeFiltersCount = filters.filter((f) => f.isActive).length
    const hasActiveFilters = activeFiltersCount > 0

    return {
        filters,
        filteredData,
        columnsConfig,
        facetedData,
        strategy,
        actions,
        tanStackFilters,
        activeFiltersCount,
        hasActiveFilters
    }
}

/**
 * Helper hook for creating column configurations
 */
export function useColumnFilterConfig() {
    const createTextColumn = useCallback(
        (
            _columnId: string,
            options: Partial<{
                filterable?: boolean
                faceted?: boolean
                placeholder?: string
                operators?: any
            }> = {}
        ) => ({
            type: 'text' as const,
            filterable: true,
            faceted: false,
            placeholder: 'Enter text...',
            ...options
        }),
        []
    )

    const createNumberColumn = useCallback(
        (
            _columnId: string,
            options: Partial<{
                filterable?: boolean
                faceted?: boolean
                placeholder?: string
                min?: number
                max?: number
                operators?: any
            }> = {}
        ) => ({
            type: 'number' as const,
            filterable: true,
            faceted: true,
            placeholder: 'Enter number...',
            ...options
        }),
        []
    )

    const createDateColumn = useCallback(
        (
            _columnId: string,
            options: Partial<{
                filterable?: boolean
                faceted?: boolean
                placeholder?: string
                operators?: any
            }> = {}
        ) => ({
            type: 'date' as const,
            filterable: true,
            faceted: true,
            placeholder: 'Select date...',
            ...options
        }),
        []
    )

    const createOptionColumn = useCallback(
        (
            _columnId: string,
            optionsList: Array<{ label: string; value: string; icon?: any }>,
            options: Partial<{
                filterable?: boolean
                faceted?: boolean
                placeholder?: string
                operators?: any
            }> = {}
        ) => ({
            type: 'option' as const,
            filterable: true,
            faceted: true,
            options: optionsList,
            placeholder: 'Select option...',
            ...options
        }),
        []
    )

    const createMultiOptionColumn = useCallback(
        (
            _columnId: string,
            optionsList: Array<{ label: string; value: string; icon?: any }>,
            options: Partial<{
                filterable?: boolean
                faceted?: boolean
                placeholder?: string
                operators?: any
            }> = {}
        ) => ({
            type: 'multiOption' as const,
            filterable: true,
            faceted: true,
            options: optionsList,
            placeholder: 'Select options...',
            ...options
        }),
        []
    )

    return {
        createTextColumn,
        createNumberColumn,
        createDateColumn,
        createOptionColumn,
        createMultiOptionColumn
    }
}

/**
 * Helper hook for creating a quick filter setup
 */
export function useQuickFilterSetup<TData = Record<string, any>>(_tableId: string, _data: TData[]) {
    const { createTextColumn, createNumberColumn, createDateColumn, createOptionColumn } =
        useColumnFilterConfig()

    // Basic text search across multiple columns
    const createQuickSearch = useCallback(
        (
            searchColumns: Array<{
                id: string
                accessor: (row: TData) => any
                weight?: number
            }>
        ) => {
            const columnsConfig: ColumnsFilterConfig = {}
            const accessors: Record<string, (row: TData) => any> = {}

            searchColumns.forEach(({ id, accessor }) => {
                columnsConfig[id] = createTextColumn(id, {
                    placeholder: `Search ${id}...`
                })
                accessors[id] = accessor
            })

            return { columnsConfig, accessors }
        },
        [createTextColumn]
    )

    return {
        createQuickSearch
    }
}
