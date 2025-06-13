/**
 * Number filter component
 * Provides filtering for numeric columns with various numeric operators and range slider
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useCallback, useEffect, useState } from "react"
import type { FilterOperators } from "../../types/filter-types"
import { FILTER_OPERATORS_LABELS, DEFAULT_OPERATORS } from "../../types/filter-types"

export interface NumberFilterProps {
    /** Current filter value - single number or [min, max] for between */
    value: number | [number, number]
    /** Current operator */
    operator: FilterOperators['number']
    /** Available operators (defaults to all number operators) */
    operators?: readonly FilterOperators['number'][]
    /** Minimum value for slider/validation */
    min?: number
    /** Maximum value for slider/validation */
    max?: number
    /** Step size for slider */
    step?: number
    /** Placeholder text for inputs */
    placeholder?: string
    /** Whether the filter is disabled */
    disabled?: boolean
    /** Callback when the value changes */
    onValueChange: (value: number | [number, number]) => void
    /** Callback when the operator changes */
    onOperatorChange: (operator: FilterOperators['number']) => void
    /** Optional label */
    label?: string
    /** Whether to show the operator selector */
    showOperator?: boolean
    /** Whether to show slider for range operations */
    showSlider?: boolean
}

/**
 * Number filter component with operator selection and numeric input/slider
 */
export function NumberFilter({
    value,
    operator,
    operators = DEFAULT_OPERATORS.number,
    min = 0,
    max = 100,
    step = 1,
    placeholder = "Enter number...",
    disabled = false,
    onValueChange,
    onOperatorChange,
    label,
    showOperator = true,
    showSlider = true
}: NumberFilterProps) {
    const [internalValue, setInternalValue] = useState(value)

    // Sync internal value with prop
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    // Handle value change with debouncing
    const handleValueChange = useCallback((newValue: number | [number, number]) => {
        setInternalValue(newValue)
        
        // Debounce the callback
        const timeoutId = setTimeout(() => {
            onValueChange(newValue)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [onValueChange])

    // Handle immediate value change
    const handleImmediateChange = useCallback((newValue: number | [number, number]) => {
        setInternalValue(newValue)
        onValueChange(newValue)
    }, [onValueChange])

    // Check if this operator needs a value input
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator)
    const isBetween = operator === 'between'
    const currentSingleValue = Array.isArray(internalValue) ? internalValue[0] : internalValue
    const currentRangeValue = Array.isArray(internalValue) ? internalValue : [min, max]

    // Handle single number input change
    const handleSingleInputChange = useCallback((inputValue: string) => {
        const numValue = parseFloat(inputValue)
        if (!isNaN(numValue)) {
            handleValueChange(numValue)
        }
    }, [handleValueChange])

    // Handle range input changes
    const handleRangeMinChange = useCallback((inputValue: string) => {
        const numValue = parseFloat(inputValue)
        if (!isNaN(numValue)) {
            const [, maxVal] = currentRangeValue
            handleValueChange([numValue, maxVal])
        }
    }, [currentRangeValue, handleValueChange])

    const handleRangeMaxChange = useCallback((inputValue: string) => {
        const numValue = parseFloat(inputValue)
        if (!isNaN(numValue)) {
            const [minVal] = currentRangeValue
            handleValueChange([minVal, numValue])
        }
    }, [currentRangeValue, handleValueChange])

    // Handle slider change
    const handleSliderChange = useCallback((values: number[]) => {
        if (isBetween) {
            handleImmediateChange([values[0], values[1]])
        } else {
            handleImmediateChange(values[0])
        }
    }, [isBetween, handleImmediateChange])

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
                        onValueChange={(value) => onOperatorChange(value as FilterOperators['number'])}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select operator..." />
                        </SelectTrigger>
                        <SelectContent>
                            {operators.map((op) => (
                                <SelectItem key={op} value={op}>
                                    {FILTER_OPERATORS_LABELS.number[op]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Value inputs */}
                {needsValue && (
                    <div className="space-y-2">
                        {isBetween ? (
                            <>
                                {/* Range inputs */}
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="number"
                                        value={currentRangeValue[0]}
                                        onChange={(e) => handleRangeMinChange(e.target.value)}
                                        placeholder="Min"
                                        disabled={disabled}
                                        className="flex-1"
                                        min={min}
                                        max={max}
                                        step={step}
                                    />
                                    <span className="text-sm text-muted-foreground">to</span>
                                    <Input
                                        type="number"
                                        value={currentRangeValue[1]}
                                        onChange={(e) => handleRangeMaxChange(e.target.value)}
                                        placeholder="Max"
                                        disabled={disabled}
                                        className="flex-1"
                                        min={min}
                                        max={max}
                                        step={step}
                                    />
                                </div>
                                
                                {/* Range slider */}
                                {showSlider && (
                                    <div className="px-2">
                                        <Slider
                                            value={currentRangeValue}
                                            onValueChange={handleSliderChange}
                                            min={min}
                                            max={max}
                                            step={step}
                                            disabled={disabled}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>{min}</span>
                                            <span>{max}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Single number input */}
                                <Input
                                    type="number"
                                    value={currentSingleValue || ''}
                                    onChange={(e) => handleSingleInputChange(e.target.value)}
                                    placeholder={placeholder}
                                    disabled={disabled}
                                    className="w-full"
                                    min={min}
                                    max={max}
                                    step={step}
                                />
                                
                                {/* Single value slider */}
                                {showSlider && (
                                    <div className="px-2">
                                        <Slider
                                            value={[currentSingleValue || min]}
                                            onValueChange={handleSliderChange}
                                            min={min}
                                            max={max}
                                            step={step}
                                            disabled={disabled}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>{min}</span>
                                            <span>{max}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
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
 * Compact number filter for use in filter chips
 */
export function CompactNumberFilter({
    value,
    operator,
    onValueChange,
    placeholder = "0",
    disabled = false
}: Pick<NumberFilterProps, 'value' | 'operator' | 'onValueChange' | 'placeholder' | 'disabled'>) {
    const [internalValue, setInternalValue] = useState(value)

    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const handleChange = useCallback((newValue: number | [number, number]) => {
        setInternalValue(newValue)
        const timeoutId = setTimeout(() => {
            onValueChange(newValue)
        }, 300)
        return () => clearTimeout(timeoutId)
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

    if (isBetween && Array.isArray(internalValue)) {
        return (
            <div className="flex gap-1 items-center">
                <Input
                    type="number"
                    value={internalValue[0]}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) {
                            handleChange([val, internalValue[1]])
                        }
                    }}
                    disabled={disabled}
                    className="h-6 text-xs w-16"
                />
                <span className="text-xs">-</span>
                <Input
                    type="number"
                    value={internalValue[1]}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) {
                            handleChange([internalValue[0], val])
                        }
                    }}
                    disabled={disabled}
                    className="h-6 text-xs w-16"
                />
            </div>
        )
    }

    const singleValue = Array.isArray(internalValue) ? internalValue[0] : internalValue

    return (
        <Input
            type="number"
            value={singleValue || ''}
            onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                    handleChange(val)
                }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="h-6 text-xs w-20"
        />
    )
} 