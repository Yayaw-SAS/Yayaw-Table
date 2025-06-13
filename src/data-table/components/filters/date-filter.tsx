/**
 * Date filter component
 * Provides filtering for date columns with various date operators and date picker
 */
"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type { FilterOperators } from "../../types/filter-types"
import { FILTER_OPERATORS_LABELS, DEFAULT_OPERATORS } from "../../types/filter-types"

export interface DateFilterProps {
    /** Current filter value - single date or [start, end] for between */
    value: Date | [Date, Date]
    /** Current operator */
    operator: FilterOperators['date']
    /** Available operators (defaults to all date operators) */
    operators?: readonly FilterOperators['date'][]
    /** Whether the filter is disabled */
    disabled?: boolean
    /** Callback when the value changes */
    onValueChange: (value: Date | [Date, Date]) => void
    /** Callback when the operator changes */
    onOperatorChange: (operator: FilterOperators['date']) => void
    /** Optional label */
    label?: string
    /** Whether to show the operator selector */
    showOperator?: boolean
    /** Date format for display */
    dateFormat?: string
}

/**
 * Date filter component with operator selection and date picker
 */
export function DateFilter({
    value,
    operator,
    operators = DEFAULT_OPERATORS.date,
    disabled = false,
    onValueChange,
    onOperatorChange,
    label,
    showOperator = true,
    dateFormat = "PPP"
}: DateFilterProps) {
    const [internalValue, setInternalValue] = useState(value)
    const [isOpen, setIsOpen] = useState(false)

    // Sync internal value with prop
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    // Handle value change
    const handleValueChange = useCallback((newValue: Date | [Date, Date]) => {
        setInternalValue(newValue)
        onValueChange(newValue)
    }, [onValueChange])

    // Check if this operator needs a value input
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator)
    const isBetween = operator === 'between'
    const currentSingleValue = Array.isArray(internalValue) ? internalValue[0] : internalValue
    const currentRangeValue = Array.isArray(internalValue) ? internalValue : [new Date(), new Date()]

    // Handle single date selection
    const handleSingleDateSelect = useCallback((date: Date | undefined) => {
        if (date) {
            handleValueChange(date)
            setIsOpen(false)
        }
    }, [handleValueChange])

    // Handle date range selection
    const handleDateRangeSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
        if (range?.from && range?.to) {
            handleValueChange([range.from, range.to])
        } else if (range?.from) {
            // If only start date is selected, set end date to same date
            handleValueChange([range.from, range.from])
        }
    }, [handleValueChange])

    // Format date for display
    const formatDateForDisplay = useCallback((date: Date | [Date, Date]) => {
        if (Array.isArray(date)) {
            return `${format(date[0], dateFormat)} - ${format(date[1], dateFormat)}`
        }
        return format(date, dateFormat)
    }, [dateFormat])

    return (
        <div className="space-y-3">
            {label && (
                <Label className="text-sm font-medium">{label}</Label>
            )}
            
            <div className="flex flex-col gap-3">
                {/* Operator selector */}
                {showOperator && (
                    <Select
                        value={operator}
                        onValueChange={(value) => onOperatorChange(value as FilterOperators['date'])}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select operator..." />
                        </SelectTrigger>
                        <SelectContent>
                            {operators.map((op) => (
                                <SelectItem key={op} value={op}>
                                    {FILTER_OPERATORS_LABELS.date[op]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Date picker */}
                {needsValue && (
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !internalValue && "text-muted-foreground"
                                )}
                                disabled={disabled}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {internalValue ? (
                                    formatDateForDisplay(internalValue)
                                ) : (
                                    <span>{isBetween ? "Pick date range..." : "Pick a date..."}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            {isBetween ? (
                                <Calendar
                                    mode="range"
                                    selected={{ from: currentRangeValue[0], to: currentRangeValue[1] }}
                                    onSelect={handleDateRangeSelect}
                                    disabled={disabled}
                                    initialFocus
                                    required
                                />
                            ) : (
                                <Calendar
                                    mode="single"
                                    selected={currentSingleValue}
                                    onSelect={handleSingleDateSelect}
                                    disabled={disabled}
                                    initialFocus
                                />
                            )}
                        </PopoverContent>
                    </Popover>
                )}

                {/* Info text for operators that don't need values */}
                {!needsValue && (
                    <div className="text-sm text-muted-foreground italic">
                        This filter will show rows where the field {operator === 'isEmpty' ? 'is empty' : 'is not empty'}.
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Compact date filter for use in filter chips
 */
export function CompactDateFilter({
    value,
    operator,
    onValueChange,
    disabled = false,
    dateFormat = "PP"
}: Pick<DateFilterProps, 'value' | 'operator' | 'onValueChange' | 'disabled' | 'dateFormat'>) {
    const [internalValue, setInternalValue] = useState(value)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const handleValueChange = useCallback((newValue: Date | [Date, Date]) => {
        setInternalValue(newValue)
        onValueChange(newValue)
    }, [onValueChange])

    const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator)
    const isBetween = operator === 'between'

    if (!needsValue) {
        return (
            <span className="text-xs text-muted-foreground">
                {operator === 'isEmpty' ? 'is empty' : 'is not empty'}
            </span>
        )
    }

    const currentSingleValue = Array.isArray(internalValue) ? internalValue[0] : internalValue
    const currentRangeValue = Array.isArray(internalValue) ? internalValue : [new Date(), new Date()]

    const handleSingleDateSelect = useCallback((date: Date | undefined) => {
        if (date) {
            handleValueChange(date)
            setIsOpen(false)
        }
    }, [handleValueChange])

    const handleDateRangeSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
        if (range?.from && range?.to) {
            handleValueChange([range.from, range.to])
        } else if (range?.from) {
            handleValueChange([range.from, range.from])
        }
    }, [handleValueChange])

    const formatDateForDisplay = useCallback((date: Date | [Date, Date]) => {
        if (Array.isArray(date)) {
            return `${format(date[0], dateFormat)} - ${format(date[1], dateFormat)}`
        }
        return format(date, dateFormat)
    }, [dateFormat])

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-6 px-2 text-xs font-normal justify-start",
                        !internalValue && "text-muted-foreground"
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {internalValue ? (
                        formatDateForDisplay(internalValue)
                    ) : (
                        "Date..."
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                {isBetween ? (
                    <Calendar
                        mode="range"
                        selected={{ from: currentRangeValue[0], to: currentRangeValue[1] }}
                        onSelect={handleDateRangeSelect}
                        disabled={disabled}
                        initialFocus
                        required
                    />
                ) : (
                    <Calendar
                        mode="single"
                        selected={currentSingleValue}
                        onSelect={handleSingleDateSelect}
                        disabled={disabled}
                        initialFocus
                    />
                )}
            </PopoverContent>
        </Popover>
    )
}

/**
 * Date range shortcuts for common date ranges
 */
export function DateRangeShortcuts({
    onSelect,
    disabled = false
}: {
    onSelect: (range: [Date, Date]) => void
    disabled?: boolean
}) {
    const shortcuts = [
        {
            label: "Today",
            getValue: () => {
                const today = new Date()
                return [today, today] as [Date, Date]
            }
        },
        {
            label: "Yesterday",
            getValue: () => {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                return [yesterday, yesterday] as [Date, Date]
            }
        },
        {
            label: "Last 7 days",
            getValue: () => {
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 6)
                return [start, end] as [Date, Date]
            }
        },
        {
            label: "Last 30 days",
            getValue: () => {
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 29)
                return [start, end] as [Date, Date]
            }
        },
        {
            label: "This month",
            getValue: () => {
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth(), 1)
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                return [start, end] as [Date, Date]
            }
        }
    ]

    return (
        <div className="flex flex-wrap gap-1">
            {shortcuts.map((shortcut) => (
                <Button
                    key={shortcut.label}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSelect(shortcut.getValue())}
                    disabled={disabled}
                >
                    {shortcut.label}
                </Button>
            ))}
        </div>
    )
} 