/**
 * Integration hook that combines existing useDataTable with advanced filters
 * Provides backward compatibility while adding advanced filtering capabilities
 */

import { useMemo, useCallback } from "react"
import type { ColumnFiltersState } from "@tanstack/react-table"
import type {
    AdvancedFiltersState,
    ColumnsFilterConfig,
    ColumnDataType,
    FilterStrategy,
    FilterActions,
    AdvancedFilterModel
} from "../types/filter-types"
import { useDataTable } from "./use-data-table"
import { useTableUrlState } from "./use-table-url-state"
import { convertToTanStackFilters, convertFromTanStackFilters } from "../utils/advanced-filters"

// Helper functions
function generateId(): string {
    return Math.random().toString(36).substr(2, 9)
}

function applyAdvancedFilters<TData>(
    data: TData[],
    filters: AdvancedFiltersState,
    accessors: Record<string, (row: TData) => any>
): TData[] {
    if (!filters.length) return data
    
    return data.filter(row => {
        return filters.every(filter => {
            if (!filter.isActive) return true
            
            const accessor = accessors[filter.columnId]
            if (!accessor) return true
            
            const value = accessor(row)
            
            // Simple filtering logic
            switch (filter.operator) {
                case 'contains':
                    return String(value).toLowerCase().includes(String(filter.values).toLowerCase())
                case 'equals':
                    return value === filter.values
                case 'is':
                    return value === filter.values
                default:
                    return true
            }
        })
    })
}

function computeFacetedData(
    data: any[],
    columnsConfig: ColumnsFilterConfig,
    accessors: Record<string, (row: any) => any>
): Record<string, any> {
    // Simple implementation - just return empty for now
    return {}
}

export interface UseDataTableAdvancedFiltersOptions<TData = Record<string, any>> {
    /** Table identifier */
    tableType: string
    /** Filter strategy - client or server */
    strategy?: FilterStrategy
    /** Data to filter (for client-side filtering) */
    data?: TData[]
    /** Advanced columns configuration */
    advancedColumnsConfig?: ColumnsFilterConfig
    /** Column accessors for data extraction */
    accessors?: Record<string, (row: TData) => any>
    /** Auto-compute faceted data */
    autoComputeFaceted?: boolean
}

export interface UseDataTableAdvancedFiltersReturn<TData = Record<string, any>> {
    // Original useDataTable return values
    columnFilters: ColumnFiltersState
    setColumnFilters: (state: ColumnFiltersState) => void
    
    // Advanced filters values
    advancedFilters: AdvancedFiltersState
    advancedActions: FilterActions
    filteredData: TData[]
    hasAdvancedFilters: boolean
    activeAdvancedFiltersCount: number
    
    // Combined state
    hasAnyFilters: boolean
    totalActiveFiltersCount: number
    
    // Utility functions
    clearAllFilters: () => void
    convertLegacyToAdvanced: (columnId: string, type: ColumnDataType) => void
}

/**
 * Hook that integrates existing table filtering with advanced filters using URL state
 */
export function useDataTableAdvancedFilters<TData = Record<string, any>>(
    options: UseDataTableAdvancedFiltersOptions<TData>
): UseDataTableAdvancedFiltersReturn<TData> {
    const {
        tableType,
        strategy = 'client',
        data = [],
        advancedColumnsConfig = {},
        accessors = {},
        autoComputeFaceted = true
    } = options

    // Use existing data table hook for backward compatibility
    const dataTableResult = useDataTable({ tableType })
    const { setColumnFilters } = dataTableResult
    const columnFilters = dataTableResult.state.columnFilters

    // Use URL state for advanced filters
    const { 
        advancedFiltersParam, 
        setAdvancedFiltersFromUI,
        resetAdvancedFilters 
    } = useTableUrlState({ tableId: tableType })

    // Advanced filters from URL state
    const advancedFilters = advancedFiltersParam || []

    console.log("useDataTableAdvancedFilters - URL state:", {
        advancedFiltersParam,
        advancedFilters,
        tableType
    })

    // Apply client-side filtering
    const filteredData = useMemo(() => {
        if (strategy === 'server' || !data.length || !advancedFilters.length) {
            return data
        }

        return applyAdvancedFilters(data, advancedFilters, accessors)
    }, [data, advancedFilters, accessors, strategy])

    // Compute faceted data for options
    const facetedData = useMemo(() => {
        if (!autoComputeFaceted || !data.length) return {}
        
        return computeFacetedData(data, advancedColumnsConfig, accessors)
    }, [data, advancedColumnsConfig, accessors, autoComputeFaceted])

    // Advanced filter actions using URL state
    const advancedActions: FilterActions = useMemo(() => ({
        addFilter: (filterData: Omit<AdvancedFilterModel, 'id' | 'createdAt' | 'updatedAt'>) => {
            const now = new Date()
            const newFilter: AdvancedFilterModel = {
                ...filterData,
                id: generateId(),
                label: filterData.label || filterData.columnId,
                createdAt: now,
                updatedAt: now
            }
            
            const newFilters = [...advancedFilters, newFilter]
            console.log("advancedActions.addFilter - Adding filter:", newFilter)
            console.log("advancedActions.addFilter - New filters:", newFilters)
            setAdvancedFiltersFromUI(newFilters)
        },

        updateFilter: (filterId: string, updates: Partial<AdvancedFilterModel>) => {
            const newFilters = advancedFilters.map(filter => 
                filter.id === filterId 
                    ? { ...filter, ...updates, updatedAt: new Date() } 
                    : filter
            )
            console.log("advancedActions.updateFilter - Updating filter:", filterId, updates)
            setAdvancedFiltersFromUI(newFilters)
        },

        removeFilter: (filterId: string) => {
            const newFilters = advancedFilters.filter(filter => filter.id !== filterId)
            console.log("advancedActions.removeFilter - Removing filter:", filterId)
            setAdvancedFiltersFromUI(newFilters)
        },

        toggleFilter: (filterId: string) => {
            const newFilters = advancedFilters.map(filter => 
                filter.id === filterId 
                    ? { ...filter, isActive: !filter.isActive, updatedAt: new Date() } 
                    : filter
            )
            console.log("advancedActions.toggleFilter - Toggling filter:", filterId)
            setAdvancedFiltersFromUI(newFilters)
        },

        clearFilters: () => {
            console.log("advancedActions.clearFilters - Clearing all advanced filters")
            resetAdvancedFilters()
        },

        applyPreset: (preset: any) => {
            // TODO: Implement preset functionality
            console.log("advancedActions.applyPreset - Not implemented yet", preset)
        },

        savePreset: (name: string, description?: string) => {
            // TODO: Implement preset functionality  
            console.log("advancedActions.savePreset - Not implemented yet", name, description)
            return {
                id: generateId(),
                name,
                description,
                filters: advancedFilters,
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: [],
                isPublic: false
            }
        }
    }), [advancedFilters, setAdvancedFiltersFromUI, resetAdvancedFilters])

    // Convert legacy filter to advanced filter
    const convertLegacyToAdvanced = useCallback((columnId: string, type: ColumnDataType) => {
        const existingLegacyFilter = columnFilters.find((f: { id: string }) => f.id === columnId)
        if (!existingLegacyFilter) return

        // Remove from legacy filters
        setColumnFilters(columnFilters.filter((f: { id: string }) => f.id !== columnId))

        // Add to advanced filters
        let value: any = ''
        let operator: any = 'contains'

        switch (type) {
            case 'text':
                value = String(existingLegacyFilter.value || '')
                operator = 'contains'
                break
            case 'number':
                value = Number(existingLegacyFilter.value) || 0
                operator = 'equals'
                break
            case 'date':
                value = existingLegacyFilter.value instanceof Date 
                    ? existingLegacyFilter.value 
                    : new Date()
                operator = 'equals'
                break
            case 'option':
                value = String(existingLegacyFilter.value || '')
                operator = 'is'
                break
            case 'multiOption':
                value = Array.isArray(existingLegacyFilter.value) 
                    ? existingLegacyFilter.value 
                    : []
                operator = 'contains'
                break
        }

        advancedActions.addFilter({
            columnId,
            type,
            operator,
            values: value,
            isActive: true
        })
    }, [columnFilters, setColumnFilters, advancedActions])

    // Clear all filters (both legacy and advanced)
    const clearAllFilters = useCallback(() => {
        setColumnFilters([])
        advancedActions.clearFilters()
    }, [setColumnFilters, advancedActions])

    // Calculate combined state
    const hasAdvancedFilters = advancedFilters.length > 0
    const activeAdvancedFiltersCount = advancedFilters.filter(f => f.isActive).length
    const hasLegacyFilters = columnFilters.length > 0
    const hasAnyFilters = hasAdvancedFilters || hasLegacyFilters
    const totalActiveFiltersCount = activeAdvancedFiltersCount + columnFilters.length

    return {
        // Legacy compatibility
        columnFilters,
        setColumnFilters,
        
        // Advanced filters
        advancedFilters,
        advancedActions,
        filteredData,
        hasAdvancedFilters,
        activeAdvancedFiltersCount,
        
        // Combined state
        hasAnyFilters,
        totalActiveFiltersCount,
        
        // Utilities
        clearAllFilters,
        convertLegacyToAdvanced
    }
}

/**
 * Helper hook for creating column configurations from existing table columns
 */
export function useColumnConfigFromTableColumns(
    columns: Array<{
        id: string
        label: string
        canFilter?: boolean
        [key: string]: any
    }>,
    typeMapping: Record<string, ColumnDataType> = {}
): ColumnsFilterConfig {
    return useMemo(() => {
        const config: ColumnsFilterConfig = {}
        
        console.log("useColumnConfigFromTableColumns - Input columns:", columns)
        console.log("useColumnConfigFromTableColumns - Type mapping:", typeMapping)
        
        columns.forEach(column => {
            // Temporairement, on ignore la condition canFilter === false
            // if (column.canFilter === false) return
            
            // Skip system columns
            if (column.id === 'select' || column.id === 'actions') return
            
            const type = typeMapping[column.id] || 'text'
            
            config[column.id] = {
                type,
                filterable: true,
                faceted: type !== 'text',
                placeholder: `Filter by ${column.label}...`,
                ...(type === 'number' && { min: 0, max: 100 }),
                ...(type === 'option' && { 
                    options: getOptionsForColumn(column.id, type)
                })
            }
        })
        
        console.log("useColumnConfigFromTableColumns - Generated config:", config)
        return config
    }, [columns, typeMapping])
}

// Helper function to get options for option-type columns
function getOptionsForColumn(columnId: string, type: ColumnDataType): any[] | undefined {
    if (type !== 'option') return undefined
    
    // Static options for our example
    switch (columnId) {
        case 'category':
            return ["Laptops", "Phones", "Tablets", "Accessories"]
        case 'status':
            return ["In Stock", "Low Stock", "Out of Stock"]
        case 'isActive':
            return [
                { value: true, label: "Active" },
                { value: false, label: "Inactive" }
            ]
        default:
            return undefined
    }
}

/**
 * Helper hook for creating accessors from table data
 */
export function useTableAccessors<TData = Record<string, any>>(
    data: TData[],
    columnIds: string[]
): Record<string, (row: TData) => any> {
    return useMemo(() => {
        const accessors: Record<string, (row: TData) => any> = {}
        
        columnIds.forEach(columnId => {
            accessors[columnId] = (row: TData) => {
                // Handle nested property access like "user.name"
                if (columnId.includes('.')) {
                    return columnId.split('.').reduce((obj: any, key) => obj?.[key], row)
                }
                // Simple property access
                return (row as any)[columnId]
            }
        })
        
        return accessors
    }, [data, columnIds])
}

/**
 * Type guard to check if filters are advanced filters
 */
export function isAdvancedFiltersState(
    filters: ColumnFiltersState | AdvancedFiltersState
): filters is AdvancedFiltersState {
    return Array.isArray(filters) && 
           filters.length > 0 && 
           typeof filters[0] === 'object' && 
           'type' in filters[0] && 
           'operator' in filters[0]
} 