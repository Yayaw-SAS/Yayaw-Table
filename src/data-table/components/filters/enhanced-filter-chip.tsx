/**
 * Enhanced Filter Chip Component
 * Modern, animated filter chips inspired by bazza/ui and Linear
 */
"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { X, Filter, ChevronDown, Zap, Calendar, Hash, Type, List, CheckSquare } from "lucide-react"

import type { AdvancedFilterModel, ColumnDataType, FilterOperators } from "../../types/filter-types"
import { FilterValueInput } from "./filter-value-input"

// Animation variants for different states
const animationClasses = {
    idle: "scale-100 opacity-100",
    hover: "scale-105 opacity-100",
    active: "scale-98 opacity-90",
    removing: "scale-95 opacity-0"
}

// Icons for different data types
const typeIcons = {
    text: Type,
    number: Hash,
    date: Calendar,
    option: CheckSquare,
    multiOption: List
} as const

// Color schemes for different filter states
const colorSchemes = {
    active: {
        chip: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
        badge: "bg-primary text-primary-foreground",
        icon: "text-primary"
    },
    inactive: {
        chip: "bg-muted/50 text-muted-foreground border-border hover:bg-muted",
        badge: "bg-muted text-muted-foreground",
        icon: "text-muted-foreground"
    },
    error: {
        chip: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15",
        badge: "bg-destructive text-destructive-foreground",
        icon: "text-destructive"
    }
} as const

interface EnhancedFilterChipProps {
    filter: AdvancedFilterModel
    columnLabel: string
    onUpdate: (updates: Partial<AdvancedFilterModel>) => void
    onRemove: () => void
    onToggle: () => void
    className?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'outline' | 'minimal'
    showTypeIcon?: boolean
    showOperator?: boolean
    maxValueLength?: number
    disabled?: boolean
    isEditing?: boolean
    onEditingChange?: (editing: boolean) => void
}

/**
 * Format filter value for display
 */
function formatFilterValue(
    values: any, 
    operator: FilterOperators[ColumnDataType], 
    type: ColumnDataType, 
    maxLength: number = 20
): string {
    if (values === null || values === undefined) return ''
    
    let displayValue = ''
    
    switch (type) {
        case 'text':
            displayValue = String(values)
            break
            
        case 'number':
            if (operator === 'between' && Array.isArray(values)) {
                displayValue = `${values[0]} - ${values[1]}`
            } else {
                displayValue = String(values)
            }
            break
            
        case 'date':
            if (operator === 'between' && Array.isArray(values)) {
                const [start, end] = values
                displayValue = `${start?.toLocaleDateString?.()} - ${end?.toLocaleDateString?.()}`
            } else if (values instanceof Date) {
                displayValue = values.toLocaleDateString()
            } else {
                displayValue = String(values)
            }
            break
            
        case 'option':
            displayValue = String(values)
            break
            
        case 'multiOption':
            if (Array.isArray(values)) {
                if (values.length === 0) return ''
                if (values.length === 1) return String(values[0])
                return `${values[0]} +${values.length - 1}`
            }
            displayValue = String(values)
            break
            
        default:
            displayValue = String(values)
    }
    
    return displayValue.length > maxLength 
        ? `${displayValue.slice(0, maxLength)}...` 
        : displayValue
}

/**
 * Get operator display text
 */
function getOperatorText(operator: FilterOperators[ColumnDataType], type: ColumnDataType): string {
    const operatorLabels: Record<string, string> = {
        contains: 'contains',
        equals: 'is',
        startsWith: 'starts with',
        endsWith: 'ends with',
        isEmpty: 'is empty',
        isNotEmpty: 'is not empty',
        gt: '>',
        gte: '≥',
        lt: '<',
        lte: '≤',
        between: 'between',
        is: 'is',
        isNot: 'is not',
        before: 'before',
        after: 'after',
        onOrBefore: 'on or before',
        onOrAfter: 'on or after'
    }
    
    return operatorLabels[operator] || operator
}

/**
 * Enhanced Filter Chip Component
 */
export function EnhancedFilterChip({
    filter,
    columnLabel,
    onUpdate,
    onRemove,
    onToggle,
    className,
    size = 'md',
    variant = 'default',
    showTypeIcon = true,
    showOperator = true,
    maxValueLength = 20,
    disabled = false,
    isEditing = false,
    onEditingChange
}: EnhancedFilterChipProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [isRemoving, setIsRemoving] = useState(false)
    const [popoverOpen, setPopoverOpen] = useState(isEditing)
    const chipRef = useRef<HTMLDivElement>(null)

    // Sync popover state with editing prop
    useEffect(() => {
        setPopoverOpen(isEditing)
    }, [isEditing])

    // Handle popover state changes
    const handlePopoverChange = (open: boolean) => {
        setPopoverOpen(open)
        onEditingChange?.(open)
    }

    // Determine color scheme based on filter state
    const colorScheme = !filter.isActive 
        ? colorSchemes.inactive 
        : filter.values === null || filter.values === undefined || filter.values === ''
            ? colorSchemes.error
            : colorSchemes.active

    // Size variants
    const sizeClasses = {
        sm: "h-6 text-xs px-2 gap-1",
        md: "h-8 text-sm px-3 gap-1.5",
        lg: "h-10 text-base px-4 gap-2"
    }

    // Get type icon
    const TypeIcon = typeIcons[filter.type] || Filter

    // Format display value
    const displayValue = formatFilterValue(
        filter.values, 
        filter.operator, 
        filter.type, 
        maxValueLength
    )

    // Handle remove with animation
    const handleRemove = async () => {
        setIsRemoving(true)
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 200))
        onRemove()
    }

    // Handle toggle
    const handleToggle = () => {
        if (!disabled) {
            onToggle()
        }
    }

    return (
        <div
            ref={chipRef}
            className={cn(
                "relative transition-all duration-200 ease-out",
                isRemoving ? animationClasses.removing : animationClasses.idle,
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Popover open={popoverOpen} onOpenChange={handlePopoverChange}>
                <PopoverTrigger asChild>
                    <div
                        className={cn(
                            "inline-flex items-center rounded-full border transition-all duration-200",
                            "cursor-pointer select-none",
                            sizeClasses[size],
                            colorScheme.chip,
                            isHovered && !disabled && "shadow-sm",
                            disabled && "opacity-50 cursor-not-allowed",
                            variant === 'outline' && "bg-transparent",
                            variant === 'minimal' && "border-none shadow-none",
                            "group"
                        )}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        aria-label={`Filter: ${columnLabel} ${getOperatorText(filter.operator, filter.type)} ${displayValue}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handlePopoverChange(true)
                            }
                        }}
                    >
                        {/* Type Icon */}
                        {showTypeIcon && (
                            <TypeIcon 
                                className={cn(
                                    "shrink-0",
                                    size === 'sm' ? "h-3 w-3" : size === 'lg' ? "h-5 w-5" : "h-4 w-4",
                                    colorScheme.icon,
                                    "transition-colors duration-200"
                                )} 
                            />
                        )}

                        {/* Filter Content */}
                        <div className="flex items-center gap-1 min-w-0">
                            {/* Column Label */}
                            <span className="font-medium truncate">
                                {columnLabel}
                            </span>

                            {/* Operator */}
                            {showOperator && displayValue && (
                                <span className="text-xs opacity-70">
                                    {getOperatorText(filter.operator, filter.type)}
                                </span>
                            )}

                            {/* Value */}
                            {displayValue && (
                                <span className="truncate">
                                    {displayValue}
                                </span>
                            )}
                        </div>

                        {/* Active State Indicator */}
                        {!filter.isActive && (
                            <Badge 
                                variant="secondary" 
                                className={cn(
                                    "ml-1 px-1.5 py-0 text-xs",
                                    size === 'sm' && "px-1 text-xs",
                                    colorScheme.badge
                                )}
                            >
                                Off
                            </Badge>
                        )}

                        {/* Expand Icon */}
                        <ChevronDown 
                            className={cn(
                                "shrink-0 ml-1 transition-transform duration-200",
                                size === 'sm' ? "h-3 w-3" : "h-4 w-4",
                                popoverOpen && "rotate-180",
                                colorScheme.icon
                            )} 
                        />
                    </div>
                </PopoverTrigger>

                <PopoverContent 
                    className="min-w-80 max-w-96 w-auto p-4"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                >
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{columnLabel}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Toggle Active State */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleToggle}
                                    className={cn(
                                        "h-6 px-2 text-xs",
                                        filter.isActive ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    {filter.isActive ? (
                                        <>
                                            <Zap className="h-3 w-3 mr-1" />
                                            Active
                                        </>
                                    ) : (
                                        'Activate'
                                    )}
                                </Button>
                                
                                {/* Remove Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemove}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Filter Configuration */}
                        <FilterValueInput
                            type={filter.type}
                            operator={filter.operator}
                            value={filter.values}
                            config={{
                                type: filter.type,
                                filterable: true
                            }}
                            onOperatorChange={(operator) => onUpdate({ operator })}
                            onValueChange={(value) => onUpdate({ values: value })}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

/**
 * Compact Filter Chip for minimal display
 */
export function CompactFilterChip({
    filter,
    columnLabel,
    onToggle,
    onRemove,
    className
}: Pick<EnhancedFilterChipProps, 'filter' | 'columnLabel' | 'onToggle' | 'onRemove' | 'className'>) {
    return (
        <EnhancedFilterChip
            filter={filter}
            columnLabel={columnLabel}
            onUpdate={() => {}} // No inline editing in compact mode
            onToggle={onToggle}
            onRemove={onRemove}
            size="sm"
            variant="minimal"
            showTypeIcon={false}
            showOperator={false}
            maxValueLength={15}
            className={className}
        />
    )
} 