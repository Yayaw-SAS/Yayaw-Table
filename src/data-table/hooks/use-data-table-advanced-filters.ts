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

const DEBUG = false

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
            
            // Enhanced filtering logic
            switch (filter.type) {
                case 'text':
                    const textValue = String(value || '').toLowerCase()
                    const textFilter = String(filter.values || '').toLowerCase()
                    
                    switch (filter.operator) {
                        case 'contains':
                            return textValue.includes(textFilter)
                        case 'equals':
                            return textValue === textFilter
                        case 'startsWith':
                            return textValue.startsWith(textFilter)
                        case 'endsWith':
                            return textValue.endsWith(textFilter)
                        case 'notContains':
                            return !textValue.includes(textFilter)
                        case 'isEmpty':
                            return !textValue || textValue.trim() === ''
                        case 'isNotEmpty':
                            return textValue && textValue.trim() !== ''
                        default:
                            return true
                    }
                
                case 'number':
                    const numValue = Number(value)
                    const numFilter = Number(filter.values)
                    
                    switch (filter.operator) {
                        case 'equals':
                            return numValue === numFilter
                        case 'greaterThan':
                            return numValue > numFilter
                        case 'lessThan':
                            return numValue < numFilter
                        case 'greaterThanOrEqual':
                            return numValue >= numFilter
                        case 'lessThanOrEqual':
                            return numValue <= numFilter
                        case 'notEquals':
                            return numValue !== numFilter
                        case 'between':
                            if (Array.isArray(filter.values) && filter.values.length === 2) {
                                const min = Number(filter.values[0])
                                const max = Number(filter.values[1])
                                return numValue >= min && numValue <= max
                            }
                            return true
                        case 'isEmpty':
                            return value == null || value === ''
                        case 'isNotEmpty':
                            return value != null && value !== ''
                        default:
                            return true
                    }
                
                case 'option':
                    switch (filter.operator) {
                        case 'is':
                            return value === filter.values
                        case 'isAnyOf':
                            return Array.isArray(filter.values) && (filter.values as any[]).includes(value)
                        case 'isNot':
                            return value !== filter.values
                        case 'isNoneOf':
                            return Array.isArray(filter.values) && !(filter.values as any[]).includes(value)
                        case 'isEmpty':
                            return value == null || value === ''
                        case 'isNotEmpty':
                            return value != null && value !== ''
                        default:
                            return true
                    }
                
                case 'date':
                    const dateValue = new Date(value)
                    const dateFilter = Array.isArray(filter.values) ? new Date(filter.values[0]) : new Date(filter.values as any)
                    
                    switch (filter.operator) {
                        case 'equals':
                            return dateValue.toDateString() === dateFilter.toDateString()
                        case 'before':
                            return dateValue < dateFilter
                        case 'after':
                            return dateValue > dateFilter
                        case 'between':
                            if (Array.isArray(filter.values) && filter.values.length === 2) {
                                const startDate = new Date(filter.values[0])
                                const endDate = new Date(filter.values[1])
                                return dateValue >= startDate && dateValue <= endDate
                            }
                            return true
                        case 'isEmpty':
                            return value == null
                        case 'isNotEmpty':
                            return value != null
                        default:
                            return true
                    }
                
                default:
                    // Fallback for backward compatibility
                    switch (filter.operator) {
                        case 'contains':
                            return String(value).toLowerCase().includes(String(filter.values).toLowerCase())
                        case 'equals':
                        case 'is':
                            return value === filter.values
                        default:
                            return true
                    }
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

    if (DEBUG) {
        console.log("useDataTableAdvancedFilters - URL state:", {
            advancedFiltersParam,
            advancedFilters,
            tableType
        })
    }

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
            if (DEBUG) {
                console.log("advancedActions.addFilter - Adding filter:", newFilter)
                console.log("advancedActions.addFilter - New filters:", newFilters)
            }
            setAdvancedFiltersFromUI(newFilters)
        },

        updateFilter: (filterId: string, updates: Partial<AdvancedFilterModel>) => {
            const newFilters = advancedFilters.map(filter => 
                filter.id === filterId 
                    ? { ...filter, ...updates, updatedAt: new Date() } 
                    : filter
            )
            if (DEBUG) {
                console.log("advancedActions.updateFilter - Updating filter:", filterId, updates)
            }
            setAdvancedFiltersFromUI(newFilters)
        },

        removeFilter: (filterId: string) => {
            const newFilters = advancedFilters.filter(filter => filter.id !== filterId)
            if (DEBUG) {
                console.log("advancedActions.removeFilter - Removing filter:", filterId)
            }
            setAdvancedFiltersFromUI(newFilters)
        },

        toggleFilter: (filterId: string) => {
            const newFilters = advancedFilters.map(filter => 
                filter.id === filterId 
                    ? { ...filter, isActive: !filter.isActive, updatedAt: new Date() } 
                    : filter
            )
            if (DEBUG) {
                console.log("advancedActions.toggleFilter - Toggling filter:", filterId)
            }
            setAdvancedFiltersFromUI(newFilters)
        },

        clearFilters: () => {
            if (DEBUG) {
                console.log("advancedActions.clearFilters - Clearing all advanced filters")
            }
            resetAdvancedFilters()
        },

        applyPreset: (preset: any) => {
            // TODO: Implement preset functionality
            if (DEBUG) {
                console.log("advancedActions.applyPreset - Not implemented yet", preset)
            }
        },

        savePreset: (name: string, description?: string) => {
            // TODO: Implement preset functionality  
            if (DEBUG) {
                console.log("advancedActions.savePreset - Not implemented yet", name, description)
            }
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
        
        if (DEBUG) {
            console.log("useColumnConfigFromTableColumns - Input columns:", columns)
            console.log("useColumnConfigFromTableColumns - Type mapping:", typeMapping)
        }
        
        columns.forEach(column => {
            // Skip system columns
            if (column.id === 'select' || column.id === 'actions') return
            
            const type = typeMapping[column.id] || 'text'
            
            // Enhanced configuration based on our table config structure
            config[column.id] = {
                type,
                filterable: column.canFilter !== false,
                faceted: type === 'option' || type === 'multiOption',
                placeholder: column.placeholder || `Filter by ${column.label}...`,
                ...(column.description && { description: column.description }),
                ...(type === 'number' && { 
                    min: column.min || 0, 
                    max: column.max || 10000 
                }),
                ...(type === 'option' && { 
                    options: column.options || getOptionsForColumn(column.id, type),
                    operators: ['is', 'isAnyOf', 'isNot', 'isEmpty', 'isNotEmpty']
                }),
                ...(type === 'text' && {
                    operators: ['contains', 'equals', 'startsWith', 'endsWith', 'notContains', 'isEmpty', 'isNotEmpty']
                }),
                ...(type === 'number' && {
                    operators: ['equals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'between', 'notEquals', 'isEmpty', 'isNotEmpty']
                }),
                ...(type === 'date' && {
                    operators: ['equals', 'before', 'after', 'between', 'notEquals', 'isEmpty', 'isNotEmpty']
                })
            }
        })
        
        if (DEBUG) {
            console.log("useColumnConfigFromTableColumns - Generated config:", config)
        }
        return config
    }, [columns, typeMapping])
}

// Helper function to get options for option-type columns
function getOptionsForColumn(columnId: string, type: ColumnDataType): any[] | undefined {
    if (type !== 'option') return undefined
    
    // Static options for our example - using consistent {value, label} format
    switch (columnId) {
        case 'category':
            return [
                { value: "Laptops", label: "Laptops" },
                { value: "Phones", label: "Phones" },
                { value: "Tablets", label: "Tablets" },
                { value: "Accessories", label: "Accessories" }
            ]
        case 'status':
            return [
                { value: "In Stock", label: "In Stock" },
                { value: "Low Stock", label: "Low Stock" },
                { value: "Out of Stock", label: "Out of Stock" }
            ]
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