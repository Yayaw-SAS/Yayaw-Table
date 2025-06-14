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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    Tag,
    Star
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
    const [activeTab, setActiveTab] = useState('popular')
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

        // Organize by tabs
        const popularOptions = available.filter(opt => opt.isPopular).slice(0, 6)
        const recentOptions = available.filter(opt => opt.isRecent && !opt.isPopular).slice(0, 6)
        
        // Group by data type for "All" tab
        const byType = available.reduce((acc, option) => {
            const category = option.category || option.type
            if (!acc[category]) acc[category] = []
            acc[category].push(option)
            return acc
        }, {} as Record<string, ColumnOption[]>)

        return {
            popular: popularOptions,
            recent: recentOptions,
            all: byType,
            search: searchTerm ? available : []
        }
    }, [columnOptions, existingFilterColumnIds, searchTerm])

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

    // Column option component
    const ColumnOptionItem = ({ option }: { option: ColumnOption }) => {
        const TypeIcon = typeIcons[option.type]
        
        return (
            <button
                onClick={() => handleSelectColumn(option)}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all duration-150",
                    "hover:bg-accent/50 group"
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
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
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
                >
                    <Plus className={cn("mr-1", iconSizes[size])} />
                    {placeholder}
                </Button>
            </PopoverTrigger>

            <PopoverContent 
                className="min-w-80 max-w-96 w-auto p-0" 
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
                        />
                    </div>
                </div>

                {searchTerm ? (
                    // Search Results
                    <div className="max-h-80 overflow-y-auto">
                        <div className="p-2">
                            {filteredOptions.search.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No columns found</p>
                                    <p className="text-xs">Try a different search term</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredOptions.search.map((option) => (
                                        <ColumnOptionItem key={option.id} option={option} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Tabbed Interface
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="border-b border-border px-3">
                            <TabsList className="grid w-full grid-cols-3 h-8">
                                <TabsTrigger value="popular" className="text-xs">
                                    <Star className="h-3 w-3 mr-1" />
                                    Popular
                                </TabsTrigger>
                                <TabsTrigger value="recent" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Recent
                                </TabsTrigger>
                                <TabsTrigger value="all" className="text-xs">
                                    <Filter className="h-3 w-3 mr-1" />
                                    All
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            <TabsContent value="popular" className="p-2 m-0">
                                {filteredOptions.popular.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <Star className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No popular filters</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredOptions.popular.map((option) => (
                                            <ColumnOptionItem key={option.id} option={option} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="recent" className="p-2 m-0">
                                {filteredOptions.recent.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No recent filters</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredOptions.recent.map((option) => (
                                            <ColumnOptionItem key={option.id} option={option} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="all" className="p-2 m-0">
                                {Object.keys(filteredOptions.all).length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No columns available</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(filteredOptions.all).map(([categoryKey, options], index) => {
                                            const category = categories[categoryKey as keyof typeof categories]
                                            const CategoryIcon = category?.icon || Filter

                                            return (
                                                <div key={categoryKey}>
                                                    {index > 0 && <Separator className="my-2" />}
                                                    
                                                    {/* Category Header */}
                                                    <div className="flex items-center gap-2 px-2 py-1 mb-2">
                                                        <CategoryIcon className={cn(
                                                            "h-3 w-3",
                                                            category?.color || "text-muted-foreground"
                                                        )} />
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            {category?.label || categoryKey}
                                                        </span>
                                                        <Badge variant="secondary" className="text-xs h-4">
                                                            {options.length}
                                                        </Badge>
                                                    </div>

                                                    {/* Category Options */}
                                                    <div className="space-y-1">
                                                        {options.map((option) => (
                                                            <ColumnOptionItem key={option.id} option={option} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                )}

                {/* Footer */}
                <div className="border-t border-border p-2">
                    <p className="text-xs text-muted-foreground text-center">
                        {searchTerm ? 'Press Esc to clear search' : 'Use tabs to navigate categories'}
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