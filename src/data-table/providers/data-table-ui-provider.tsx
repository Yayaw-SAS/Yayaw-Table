/**
 * DataTableUIProvider
 * Centralized provider for all UI-related configurations of the DataTable
 * Handles translations, table options, and column configurations in one place
 */
'use client'

import { useAtomValue } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import { type ReactNode, useMemo } from 'react'
// Import using absolute path to fix module resolution issue
import {
    type DataTableColumnsConfig,
    type DataTableConfig,
    tableColumnsConfigAtom,
    tableConfigAtom
} from '../atoms/config-atoms'

import { type DataTableTranslations, resolvedTranslationsAtom } from '../atoms/i18n-atoms'

interface DataTableUIProviderProps {
    /**
     * Children components that will have access to the provider's context
     */
    children: ReactNode

    /**
     * Optional column configuration options
     */
    columnsConfig?: Partial<DataTableColumnsConfig>

    /**
     * Optional table configuration options
     */
    tableConfig?: Partial<DataTableConfig>

    /**
     * Table identifier - used to scope configurations
     */
    tableId: string

    /**
     * Pre-translated values to use directly
     * This simplifies the translation process by using already translated strings
     */
    translations: DataTableTranslations
}

/**
 * Provider component that centralizes all UI-related configurations for the DataTable
 * This includes translations, table options, and column configurations
 */
export function DataTableUIProvider({
    children,
    columnsConfig,
    tableConfig,
    tableId,
    translations
}: DataTableUIProviderProps) {
    // With this approach, we directly use the pre-translated values
    // No need to process or resolve translations inside the provider

    // Prepare table configuration
    const defaultTableConfig = useAtomValue(tableConfigAtom)
    const mergedTableConfig = useMemo(() => {
        return tableConfig ? { ...defaultTableConfig, ...tableConfig } : defaultTableConfig
    }, [defaultTableConfig, tableConfig])

    // Prepare columns configuration
    const defaultColumnsConfig = useAtomValue(tableColumnsConfigAtom)
    const mergedColumnsConfig = useMemo(() => {
        return columnsConfig ? { ...defaultColumnsConfig, ...columnsConfig } : defaultColumnsConfig
    }, [defaultColumnsConfig, columnsConfig])

    // Hydrate all atoms with the provided values
    // No need to resolve translations as they are already pre-translated
    useHydrateAtoms([
        [resolvedTranslationsAtom, translations],
        [tableConfigAtom, mergedTableConfig],
        [tableColumnsConfigAtom, mergedColumnsConfig]
    ])

    return <>{children}</>
}
