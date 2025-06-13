"use client"

import { Button } from "@/components/ui/button"
import {
    StackMenu,
    StackMenuContent,
    StackMenuSection,
    StackMenuItem,
    StackMenuView,
    useStackMenu
} from "@/src/components/ui-custom/stack-menu"
import {
    ArrowLeft,
    ArrowUpDown,
    Layers,
    Layers3,
    List,
    ListFilter,
    SlidersHorizontal
} from "lucide-react"
import { useTranslations } from "../../providers/table-provider"
import { useCallback, useEffect, useRef, useState } from "react"

import { TableColumnsMenu } from "./sections/table-columns-menu"
import { TableFiltersMenu } from "./sections/table-filters-menu"
import { TableGroupingMenu } from "./sections/table-grouping-menu"
import { TableSortMenu } from "./sections/table-sort-menu"

import type { TableState } from "@tanstack/react-table"

const DEBUG = false

export interface TableMenuProps {
    columns: TableColumn[]
    invalidateTable: () => Promise<void>
    setColumnFilters: (state: TableState["columnFilters"]) => void
    setColumnVisibility: (state: TableState["columnVisibility"]) => void
    setGrouping: (state: TableState["grouping"]) => void
    setSorting: (state: TableState["sorting"]) => void
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
    const [visibleCount, setVisibleCount] = useState(0)

    if (DEBUG) {
        console.log("TableMenu - columns:", columns)
        console.log("TableMenu - state:", state)
        console.log("TableMenu - activeView:", activeView)
        console.log("TableMenu - stackMenuContext:", stackMenuContext)
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
            console.log("ActiveView changed to:", activeView)
        }
    }, [activeView])

    // Early return if no columns
    if (!columns || columns.length === 0) {
        return (
            <Button className="ml-auto h-8 gap-1" disabled size="sm" variant="outline">
                <List className="h-3.5 w-3.5" />
                <span>{t("menu.options")}</span>
            </Button>
        )
    }

    const activeFiltersCount = state.columnFilters.length
    const activeGrouping = state.grouping[0]
    const activeSortCount = state.sorting.length

    // Navigation titles for different views
    const getNavigationTitle = (viewName: string) => {
        switch (viewName) {
            case "columns":
                return t("menu.columns")
            case "filters":
                return t("menu.filters")
            case "group":
                return t("menu.group")
            case "sort":
                return t("menu.sort")
            case "subgroup":
                return t("menu.subgroup")
            default:
                return t("menu.options")
        }
    }

    return (
        <StackMenu
            asDropdown
            defaultView="main"
            onOpenChange={(isOpen) => {
                if (DEBUG) {
                    console.log("Stack menu open state changed:", isOpen)
                }
                setOpen(isOpen)
            }}
            open={open}
            ref={menuRef}
            trigger={
                <Button className="h-8 gap-2 px-3" size="sm" variant="outline">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>{t("menu.options")}</span>
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
                            description={t("menu.columns_visible", {
                                count: displayVisibleCount
                            })}
                            icon={<List className="h-4 w-4" />}
                            navigateTo="columns"
                            navigateTitle={getNavigationTitle("columns")}
                        >
                            {t("menu.properties")}
                        </StackMenuItem>

                        <StackMenuItem
                            description={activeFiltersCount > 0 ? `${activeFiltersCount} active` : undefined}
                            icon={<ListFilter className="h-4 w-4" />}
                            navigateTo="filters"
                            navigateTitle={getNavigationTitle("filters")}
                            endIcon={activeFiltersCount > 0 ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                    {activeFiltersCount}
                                </span>
                            ) : undefined}
                        >
                            {t("menu.filter")}
                        </StackMenuItem>

                        <StackMenuItem
                            description={activeSortCount > 0 ? `${activeSortCount} active` : undefined}
                            icon={<ArrowUpDown className="h-4 w-4" />}
                            navigateTo="sort"
                            navigateTitle={getNavigationTitle("sort")}
                            endIcon={activeSortCount > 0 ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                    {activeSortCount}
                                </span>
                            ) : undefined}
                        >
                            {t("menu.sort")}
                        </StackMenuItem>

                        <StackMenuItem
                            description={activeGrouping}
                            icon={<Layers className="h-4 w-4" />}
                            navigateTo="group"
                            navigateTitle={getNavigationTitle("group")}
                        >
                            {t("menu.group")}
                        </StackMenuItem>

                        <StackMenuItem 
                            icon={<Layers3 className="h-4 w-4" />} 
                            navigateTo="subgroup"
                            navigateTitle={getNavigationTitle("subgroup")}
                        >
                            {t("menu.subgroup")}
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
                            console.log("TableMenu - Column visible count changed:", count)
                        }
                        handleVisibleCountChange(count)
                    }}
                    setColumnVisibility={(value) => {
                        if (DEBUG) {
                            console.log("TableMenu - Setting column visibility:", value)
                        }
                        try {
                            const newVisibility = { ...value }
                            setColumnVisibility(newVisibility)
                        } catch (error) {
                            console.error(
                                "Error in TableMenu when setting column visibility:",
                                error
                            )
                        }
                    }}
                    tableId={tableId}
                />
            </StackMenuView>

            <StackMenuView name="filters">
                <TableFiltersMenu
                    columnFilters={state.columnFilters}
                    columns={columns}
                    invalidateTable={invalidateTable}
                    setColumnFilters={setColumnFilters}
                    tableId={tableId}
                    useAdvancedFilters={useAdvancedFilters}
                    advancedFilters={useAdvancedFilters ? advancedFiltersConfig?.filters : undefined}
                    advancedActions={useAdvancedFilters ? advancedFiltersConfig?.actions : undefined}
                    advancedColumnsConfig={useAdvancedFilters ? advancedFiltersConfig?.columnsConfig : undefined}
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
