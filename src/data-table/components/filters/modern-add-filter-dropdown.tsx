/**
 * Modern Add Filter Dropdown
 * Inspired by Linear's filter addition interface
 */
"use client"

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
    Plus, 
    Search, 
    Type, 
    Hash, 
    Calendar, 
    CheckSquare, 
    List,
    Filter,
    Zap,
    Clock,
    Tag
} from "lucide-react"

import type { ColumnsFilterConfig, ColumnDataType } from "../../types/filter-types"

// Icons for different data types
const typeIcons = {
    text: Type,
    number: Hash,
    date: Calendar,
    option: CheckSquare,
    multiOption: List
} as const

// Colors for different data types
const typeColors = {
    text: "text-blue-600 bg-blue-50 border-blue-200",
    number: "text-emerald-600 bg-emerald-50 border-emerald-200",
    date: "text-purple-600 bg-purple-50 border-purple-200",
    option: "text-orange-600 bg-orange-50 border-orange-200",
    multiOption: "text-pink-600 bg-pink-50 border-pink-200"
} as const

// Categories for organizing columns
const categories = {
    recent: {
        label: "Recently Used",
        icon: Clock,
        color: "text-muted-foreground"
    },
    popular: {
        label: "Popular",
        icon: Zap,
        color: "text-amber-600"
    },
    text: {
        label: "Text Fields",
        icon: Type,
        color: "text-blue-600"
    },
    number: {
        label: "Number Fields", 
        icon: Hash,
        color: "text-emerald-600"
    },
    date: {
        label: "Date Fields",
        icon: Calendar,
        color: "text-purple-600"
    },
    option: {
        label: "Selection Fields",
        icon: Tag,
        color: "text-orange-600"
    }
} as const

interface ColumnOption {
    id: string
    label: string
    type: ColumnDataType
    description?: string
    category?: keyof typeof categories
    isRecent?: boolean
    isPopular?: boolean
    isFilterable?: boolean
}

interface ModernAddFilterDropdownProps {
    columnsConfig: ColumnsFilterConfig
    onAddFilter: (columnId: string, type: ColumnDataType) => void
    existingFilterColumnIds?: string[]
    recentColumns?: string[]
    popularColumns?: string[]
    className?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'outline' | 'ghost'
    disabled?: boolean
    placeholder?: string
}

/**
 * Modern Add Filter Dropdown Component
 */
export function ModernAddFilterDropdown({
    columnsConfig,
    onAddFilter,
    existingFilterColumnIds = [],
    recentColumns = [],
    popularColumns = [],
    className,
    size = 'md',
    variant = 'default',
    disabled = false,
    placeholder = "Add filter..."
}: ModernAddFilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Convert config to column options
    const columnOptions = useMemo<ColumnOption[]>(() => {
        return Object.entries(columnsConfig)
            .filter(([_, config]) => config.filterable !== false)
            .map(([columnId, config]) => ({
                id: columnId,
                label: columnId,
                type: config.type,
                description: config.placeholder,
                isRecent: recentColumns.includes(columnId),
                isPopular: popularColumns.includes(columnId),
                isFilterable: config.filterable !== false,
                category: config.type === 'multiOption' ? 'option' : config.type
            }))
    }, [columnsConfig, recentColumns, popularColumns])

    // Filter and categorize options
    const filteredOptions = useMemo(() => {
        const searchLower = searchTerm.toLowerCase()
        const available = columnOptions.filter(option => 
            !existingFilterColumnIds.includes(option.id) &&
            (searchTerm === '' || 
             option.label.toLowerCase().includes(searchLower) ||
             option.description?.toLowerCase().includes(searchLower))
        )

        // Group by categories
        const grouped: Record<string, ColumnOption[]> = {}
        
        // Add recent if we have search term or recent items
        if (searchTerm === '' && available.some(opt => opt.isRecent)) {
            grouped.recent = available.filter(opt => opt.isRecent).slice(0, 3)
        }
        
        // Add popular if no search term
        if (searchTerm === '' && available.some(opt => opt.isPopular)) {
            grouped.popular = available.filter(opt => opt.isPopular && !opt.isRecent).slice(0, 3)
        }

        // Group by data type
        const byType = available.reduce((acc, option) => {
            const category = option.category || option.type
            if (!acc[category]) acc[category] = []
            acc[category].push(option)
            return acc
        }, {} as Record<string, ColumnOption[]>)

        // Merge type groups
        Object.assign(grouped, byType)

        return grouped
    }, [columnOptions, existingFilterColumnIds, searchTerm])

    // Flatten for keyboard navigation
    const flatOptions = useMemo(() => {
        return Object.values(filteredOptions).flat()
    }, [filteredOptions])

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, flatOptions.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
                e.preventDefault()
                if (flatOptions[selectedIndex]) {
                    handleSelectColumn(flatOptions[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                break
        }
    }

    // Handle column selection
    const handleSelectColumn = (option: ColumnOption) => {
        onAddFilter(option.id, option.type)
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(0)
    }

    // Handle popover state changes
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (open) {
            // Focus search input when opened
            setTimeout(() => {
                searchInputRef.current?.focus()
            }, 100)
        } else {
            setSearchTerm('')
            setSelectedIndex(0)
        }
    }

    // Size variants
    const sizeClasses = {
        sm: "h-7 px-2 text-xs",
        md: "h-8 px-3 text-sm", 
        lg: "h-10 px-4 text-base"
    }

    const iconSizes = {
        sm: "h-3 w-3",
        md: "h-4 w-4",
        lg: "h-5 w-5"
    }

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant={variant}
                    size="sm"
                    disabled={disabled}
                    className={cn(
                        "transition-all duration-200",
                        sizeClasses[size],
                        "hover:shadow-sm",
                        className
                    )}
                    onKeyDown={handleKeyDown}
                >
                    <Plus className={cn("mr-1", iconSizes[size])} />
                    {placeholder}
                </Button>
            </PopoverTrigger>

            <PopoverContent 
                className="w-80 p-0" 
                align="start"
                side="bottom"
                sideOffset={4}
            >
                <div className="border-b border-border p-3">
                    {/* Search Header */}
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search columns..."
                            className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                <ScrollArea className="max-h-96">
                    <div className="p-2">
                        {Object.keys(filteredOptions).length === 0 ? (
                            // Empty state
                            <div className="text-center py-8 text-muted-foreground">
                                <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No columns available</p>
                                <p className="text-xs">All filterable columns are already in use</p>
                            </div>
                        ) : (
                            // Categories
                            Object.entries(filteredOptions).map(([categoryKey, options], categoryIndex) => {
                                const category = categories[categoryKey as keyof typeof categories]
                                const CategoryIcon = category?.icon || Filter

                                return (
                                    <div key={categoryKey}>
                                        {categoryIndex > 0 && <Separator className="my-2" />}
                                        
                                        {/* Category Header */}
                                        <div className="flex items-center gap-2 px-2 py-1 mb-1">
                                            <CategoryIcon className={cn(
                                                "h-3 w-3",
                                                category?.color || "text-muted-foreground"
                                            )} />
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {category?.label || categoryKey}
                                            </span>
                                            <Badge variant="secondary" className="text-xs">
                                                {options.length}
                                            </Badge>
                                        </div>

                                        {/* Category Options */}
                                        <div className="space-y-1">
                                            {options.map((option, optionIndex) => {
                                                const globalIndex = Object.values(filteredOptions)
                                                    .slice(0, categoryIndex)
                                                    .flat().length + optionIndex
                                                const TypeIcon = typeIcons[option.type]
                                                const isSelected = globalIndex === selectedIndex

                                                return (
                                                    <button
                                                        key={option.id}
                                                        onClick={() => handleSelectColumn(option)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all duration-150",
                                                            "hover:bg-accent/50",
                                                            isSelected && "bg-accent"
                                                        )}
                                                    >
                                                        {/* Type Icon */}
                                                        <div className={cn(
                                                            "flex items-center justify-center w-6 h-6 rounded border",
                                                            typeColors[option.type]
                                                        )}>
                                                            <TypeIcon className="h-3 w-3" />
                                                        </div>

                                                        {/* Column Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm truncate">
                                                                    {option.label}
                                                                </span>
                                                                {option.isRecent && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        Recent
                                                                    </Badge>
                                                                )}
                                                                {option.isPopular && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        Popular
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {option.description && (
                                                                <p className="text-xs text-muted-foreground truncate">
                                                                    {option.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Add Icon */}
                                                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="border-t border-border p-2">
                    <p className="text-xs text-muted-foreground text-center">
                        Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑↓</kbd> to navigate, 
                        <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-1">Enter</kbd> to select
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    )
}

/**
 * Quick Add Filter Button - simplified version
 */
export function QuickAddFilterButton({
    onAddFilter,
    availableColumns,
    className
}: {
    onAddFilter: (columnId: string, type: ColumnDataType) => void
    availableColumns: Array<{ id: string; type: ColumnDataType; label: string }>
    className?: string
}) {
    // Show first available column as quick add
    const firstAvailable = availableColumns[0]

    if (!firstAvailable) return null

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddFilter(firstAvailable.id, firstAvailable.type)}
            className={cn(
                "h-8 px-2 text-xs text-muted-foreground hover:text-foreground",
                "border border-dashed border-border hover:border-solid hover:bg-accent",
                "transition-all duration-200",
                className
            )}
        >
            <Plus className="h-3 w-3 mr-1" />
            Add {firstAvailable.label}
        </Button>
    )
} 