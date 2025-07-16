/**
 * Filter atoms for DataTable component
 * These atoms manage filter-related state
 */
import type { ColumnFiltersState } from '@tanstack/react-table'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

import { columnFiltersAtom } from './table-atoms'

/**
 * Interface for a filter preset
 * Represents a saved filter configuration
 */
export interface FilterPreset {
    filters: ColumnFiltersState
    id: string
    isDefault?: boolean
    name: string
    tableId: string
}

/**
 * Helper function to clean Turbopack references from column IDs
 * @param columnId Column ID that might contain Turbopack references
 * @returns Cleaned column ID
 */
export function cleanColumnId(columnId: string): string {
    if (typeof columnId !== 'string') {
        return String(columnId)
    }

    // No need for logging here

    // If it doesn't contain Turbopack references or parentheses, return as is
    if (!(columnId.includes('__TURBOPACK_') || columnId.includes('(') || columnId.includes(')'))) {
        return columnId
    }

    // Try to extract accessorKey from the column definition - this is the most reliable identifier
    const accessorKeyMatch =
        columnId.match(/accessorKey:\s*["']([^"']+)["']/i) ||
        columnId.match(/accessorKey=\{["']([^"']+)["']\}/i) ||
        columnId.match(/accessorKey=["']([^"']+)["']/i)

    if (accessorKeyMatch?.[1]) {
        return accessorKeyMatch[1]
    }

    // Try to extract translation key from t() function calls with various patterns
    const translationPatterns = [
        /title:\s*t\(["']([^"']+)["']\)/i,
        /title=\{t\(["']([^"']+)["']\)\}/i,
        /header:\s*t\(["']([^"']+)["']\)/i,
        /header=\{t\(["']([^"']+)["']\)\}/i,
        /t\(["']([^"']+)["']\)/i, // Generic t() call
        /\{t\(["']([^"']+)["']\)\}/i // Generic {t()} call
    ]

    for (const pattern of translationPatterns) {
        const match = columnId.match(pattern)
        if (match?.[1]) {
            return match[1]
        }
    }

    // Try to extract id from the column definition
    const idMatch =
        columnId.match(/id:\s*["']([^"']+)["']/i) ||
        columnId.match(/id=\{["']([^"']+)["']\}/i) ||
        columnId.match(/id=["']([^"']+)["']/i)

    if (idMatch?.[1]) {
        return idMatch[1]
    }

    // Try to extract the column name from the header prop if it's a component
    const headerComponentMatch = columnId.match(/header:\s*\(\{[^}]*\}\)\s*=>\s*<([^>]+)/)
    if (headerComponentMatch?.[1]) {
        // Extract the component name, which is often descriptive
        const componentName = headerComponentMatch[1].split(' ')[0]

        return componentName
    }

    // If all else fails, extract the last part of the path and clean it
    const parts = columnId.split('/')
    const lastPart = parts.at(-1)

    // Remove any remaining Turbopack references and special characters
    const cleaned = lastPart
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\{.*?\}/g, '')
        .replace(/".*?"/g, '')
        .replace(/__TURBOPACK__.*?__/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim()

    // If we still have nothing usable, default to a generic column name
    return cleaned || 'column'
}

/**
 * Atom family for storing filter presets for a specific table
 * Keyed by tableId
 */
export const filterPresetsAtom = atomFamily((_tableId: string) => atom<FilterPreset[]>([]))

/**
 * Atom family for storing the active filter preset ID
 * Keyed by tableId
 */
export const activeFilterPresetIdAtom = atomFamily((_tableId: string) => atom<null | string>(null))

/**
 * Atom family for storing whether the filter panel is open
 * Keyed by tableId
 */
export const isFilterPanelOpenAtom = atomFamily((_tableId: string) => atom<boolean>(false))

/**
 * Derived atom family that returns the active filter preset
 * Keyed by tableId
 */
export const activeFilterPresetAtom = atomFamily((tableId: string) =>
    atom((get) => {
        const presetId = get(activeFilterPresetIdAtom(tableId))
        const presets = get(filterPresetsAtom(tableId))

        if (!presetId) {
            return null
        }
        return presets.find((preset) => preset.id === presetId) || null
    })
)

/**
 * Atom family for tracking whether filters have been modified
 * Compares current filters with the active preset
 * Keyed by tableId
 */
export const hasFilterChangesAtom = atomFamily((tableId: string) =>
    atom((get) => {
        const activePreset = get(activeFilterPresetAtom(tableId))
        const currentFilters = get(columnFiltersAtom(tableId))

        if (!activePreset) {
            return currentFilters.length > 0
        }

        // Simple comparison - in a real app you might want a deeper comparison
        return JSON.stringify(activePreset.filters) !== JSON.stringify(currentFilters)
    })
)

/**
 * Atom family that provides normalized column filters with cleaned IDs
 * This helps prevent issues with Turbopack references in column IDs
 * Keyed by tableId
 */
export const normalizedColumnFiltersAtom = atomFamily((tableId: string) =>
    atom((get) => {
        const columnFilters = get(columnFiltersAtom(tableId))

        // Normalize column filters by cleaning their IDs
        return columnFilters.map((filter) => ({
            ...filter,
            id: cleanColumnId(filter.id as string)
        }))
    })
)

/**
 * Atom family for storing a mapping between original column IDs and their cleaned versions
 * This helps maintain consistency when applying filters
 * Keyed by tableId
 */
export const columnIdMappingAtom = atomFamily((tableId: string) =>
    atom((get) => {
        const columnFilters = get(columnFiltersAtom(tableId))

        // Create a mapping of original IDs to cleaned IDs
        const mapping = new Map<string, string>()

        for (const filter of columnFilters) {
            const originalId = filter.id as string
            const cleanedId = cleanColumnId(originalId)

            if (originalId !== cleanedId) {
                mapping.set(originalId, cleanedId)
                mapping.set(cleanedId, originalId) // Bidirectional mapping
            }
        }

        return mapping
    })
)
