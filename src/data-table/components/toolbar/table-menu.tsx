'use client'

import type { TableState } from '@tanstack/react-table'
import { ArrowUpDown, Layers, Layers3, List, ListFilter, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    StackMenu,
    StackMenuContent,
    StackMenuItem,
    StackMenuSection,
    StackMenuView,
    useStackMenu
} from '@/src/components/ui-custom/stack-menu'
import { useTranslations } from '../../providers/table-provider'
import { TableColumnsMenu } from './sections/table-columns-menu'
import { TableFiltersMenu } from './sections/table-filters-menu'
import { TableGroupingMenu } from './sections/table-grouping-menu'
import { TableSortMenu } from './sections/table-sort-menu'

const DEBUG = false

export interface TableMenuProps {
    columns: TableColumn[]
    invalidateTable: () => Promise<void>
    setColumnFilters: (state: TableState['columnFilters']) => void
    setColumnVisibility: (state: TableState['columnVisibility']) => void
    setGrouping: (state: TableState['grouping']) => void
    setSorting: (state: TableState['sorting']) => void
    state: TableState
    tableId: string
    /** Whether to use advanced filters menu */
    useAdvancedFilters?: boolean
    /** Advanced filters configuration */
    advancedFiltersConfig?: {
        filters: any[]
        actions: any
        columnsConfig: any
        onConvertToAdvanced?: (columnId: string, type: any) => void
    }
}

/**
 * Interface for table column definition
 */
interface TableColumn {
    canFilter?: boolean
    canGroup?: boolean
    canHide?: boolean
    canSort?: boolean
    id: string
    label: string
} // ordre déjà correct ici

// Add this adapter function before the TableMenu component
const adaptToTanstackColumns = (
    columns: TableColumn[]
): Array<{
    canHide?: boolean
    canSort?: boolean
    getCanSort: () => boolean
    id: string
    label: string
}> => {
    return columns.map((col) => ({
        canHide: col.canHide,
        canSort: col.canSort,
        getCanSort: () => col.canSort !== false,
        id: col.id,
        label: col.label
    }))
}

export function TableMenu({
    columns = [],
    invalidateTable,
    setColumnFilters,
    setColumnVisibility,
    setGrouping,
    setSorting,
    state,
    tableId,
    useAdvancedFilters = false,
    advancedFiltersConfig
}: TableMenuProps) {
    const { t } = useTranslations()
    const stackMenuContext = useStackMenu()
    const { activeView } = stackMenuContext
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const [_visibleCount, _setVisibleCount] = useState(0)

    if (DEBUG) {
    }

    // Calculate visible columns count
    const hideableColumns = columns.filter((col) => col.canHide !== false)
    const visibleColumnsCount = hideableColumns.filter(
        (col) => state.columnVisibility[col.id] !== false
    ).length

    // Track visible columns count for main menu display
    const [displayVisibleCount, setDisplayVisibleCount] = useState(visibleColumnsCount)

    const handleVisibleCountChange = useCallback((count: number) => {
        setDisplayVisibleCount(count)
    }, [])

    // Effect to log active view changes
    useEffect(() => {
        if (DEBUG) {
        }
    }, [])

    // Early return if no columns
    if (!columns || columns.length === 0) {
        return (
            <Button className="ml-auto h-8 gap-1" disabled size="sm" variant="outline">
                <List className="h-3.5 w-3.5" />
                <span>{t('menu.options')}</span>
            </Button>
        )
    }

    const activeFiltersCount = state.columnFilters.length
    const activeGrouping = state.grouping[0]
    const activeSortCount = state.sorting.length

    // Navigation titles for different views
    const getNavigationTitle = (viewName: string) => {
        switch (viewName) {
            case 'columns':
                return t('menu.properties')
            case 'filters':
                return t('menu.filters')
            case 'group':
                return t('menu.group')
            case 'sort':
                return t('menu.sort')
            case 'subgroup':
                return t('menu.subgroup')
            default:
                return t('menu.options')
        }
    }

    return (
        <StackMenu
            asDropdown
            defaultView="main"
            onOpenChange={(isOpen) => {
                if (DEBUG) {
                }
                setOpen(isOpen)
            }}
            open={open}
            ref={menuRef}
            trigger={
                <Button className="h-8 gap-2 px-3" size="sm" variant="outline">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>{t('menu.options')}</span>
                    {(activeFiltersCount > 0 || activeSortCount > 0) && (
                        <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                            {activeFiltersCount + activeSortCount}
                        </span>
                    )}
                </Button>
            }
        >
            <StackMenuView name="main">
                <StackMenuContent>
                    <StackMenuSection>
                        <StackMenuItem
                            description={t('menu.columns_visible', {
                                count: displayVisibleCount
                            })}
                            icon={<List className="h-4 w-4" />}
                            navigateTitle={getNavigationTitle('columns')}
                            navigateTo="columns"
                        >
                            {t('menu.properties')}
                        </StackMenuItem>

                        <StackMenuItem
                            description={
                                activeFiltersCount > 0 ? `${activeFiltersCount} active` : undefined
                            }
                            endIcon={
                                activeFiltersCount > 0 ? (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                        {activeFiltersCount}
                                    </span>
                                ) : undefined
                            }
                            icon={<ListFilter className="h-4 w-4" />}
                            navigateTitle={getNavigationTitle('filters')}
                            navigateTo="filters"
                        >
                            {t('menu.filter')}
                        </StackMenuItem>

                        <StackMenuItem
                            description={
                                activeSortCount > 0 ? `${activeSortCount} active` : undefined
                            }
                            endIcon={
                                activeSortCount > 0 ? (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                        {activeSortCount}
                                    </span>
                                ) : undefined
                            }
                            icon={<ArrowUpDown className="h-4 w-4" />}
                            navigateTitle={getNavigationTitle('sort')}
                            navigateTo="sort"
                        >
                            {t('menu.sort')}
                        </StackMenuItem>

                        <StackMenuItem
                            description={activeGrouping}
                            icon={<Layers className="h-4 w-4" />}
                            navigateTitle={getNavigationTitle('group')}
                            navigateTo="group"
                        >
                            {t('menu.group')}
                        </StackMenuItem>

                        <StackMenuItem
                            icon={<Layers3 className="h-4 w-4" />}
                            navigateTitle={getNavigationTitle('subgroup')}
                            navigateTo="subgroup"
                        >
                            {t('menu.subgroup')}
                        </StackMenuItem>
                    </StackMenuSection>
                </StackMenuContent>
            </StackMenuView>

            <StackMenuView name="columns">
                <TableColumnsMenu
                    columns={adaptToTanstackColumns(columns)}
                    columnVisibility={state.columnVisibility}
                    onVisibleCountChange={(count) => {
                        if (DEBUG) {
                        }
                        handleVisibleCountChange(count)
                    }}
                    setColumnVisibility={(value) => {
                        if (DEBUG) {
                        }
                        try {
                            const newVisibility = { ...value }
                            setColumnVisibility(newVisibility)
                        } catch (_error) {}
                    }}
                    tableId={tableId}
                />
            </StackMenuView>

            <StackMenuView name="filters">
                <TableFiltersMenu
                    advancedActions={
                        useAdvancedFilters ? advancedFiltersConfig?.actions : undefined
                    }
                    advancedColumnsConfig={
                        useAdvancedFilters ? advancedFiltersConfig?.columnsConfig : undefined
                    }
                    advancedFilters={
                        useAdvancedFilters ? advancedFiltersConfig?.filters : undefined
                    }
                    columnFilters={state.columnFilters}
                    columns={columns}
                    invalidateTable={invalidateTable}
                    setColumnFilters={setColumnFilters}
                    tableId={tableId}
                    useAdvancedFilters={useAdvancedFilters}
                />
            </StackMenuView>

            <StackMenuView name="sort">
                <TableSortMenu
                    columns={adaptToTanstackColumns(columns)}
                    invalidateTable={invalidateTable}
                    setSorting={setSorting}
                    sorting={state.sorting}
                    tableId={tableId}
                />
            </StackMenuView>

            <StackMenuView name="group">
                <TableGroupingMenu
                    columns={columns}
                    grouping={state.grouping}
                    invalidateTable={invalidateTable}
                    setGrouping={setGrouping}
                    tableId={tableId}
                />
            </StackMenuView>

            <StackMenuView name="subgroup">
                <TableGroupingMenu
                    columns={columns}
                    grouping={state.grouping}
                    invalidateTable={invalidateTable}
                    setGrouping={setGrouping}
                    tableId={tableId}
                />
            </StackMenuView>
        </StackMenu>
    )
}
