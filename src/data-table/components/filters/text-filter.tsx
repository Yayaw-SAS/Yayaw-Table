/**
 * Text filter component
 * Provides filtering for text-based columns with various text operators
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
import { useCallback, useEffect, useState } from "react"
import type { FilterOperators } from "../../types/filter-types"
import { FILTER_OPERATORS_LABELS, DEFAULT_OPERATORS } from "../../types/filter-types"

export interface TextFilterProps {
    /** Current filter value */
    value: string
    /** Current operator */
    operator: FilterOperators['text']
    /** Available operators (defaults to all text operators) */
    operators?: readonly FilterOperators['text'][]
    /** Placeholder text */
    placeholder?: string
    /** Whether the filter is disabled */
    disabled?: boolean
    /** Callback when the value changes */
    onValueChange: (value: string) => void
    /** Callback when the operator changes */
    onOperatorChange: (operator: FilterOperators['text']) => void
    /** Optional label */
    label?: string
    /** Whether to show the operator selector */
    showOperator?: boolean
}

/**
 * Text filter component with operator selection and text input
 */
export function TextFilter({
    value,
    operator,
    operators = DEFAULT_OPERATORS.text,
    placeholder = "Enter text...",
    disabled = false,
    onValueChange,
    onOperatorChange,
    label,
    showOperator = true
}: TextFilterProps) {
    const [internalValue, setInternalValue] = useState(value)

    // Sync internal value with prop
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    // Handle value change with debouncing
    const handleValueChange = useCallback((newValue: string) => {
        setInternalValue(newValue)
        
        // Debounce the callback
        const timeoutId = setTimeout(() => {
            onValueChange(newValue)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [onValueChange])

    // Handle immediate value change for certain operators
    const handleImmediateChange = useCallback((newValue: string) => {
        setInternalValue(newValue)
        onValueChange(newValue)
    }, [onValueChange])

    // Check if this operator needs a value input
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator)

    return (
        <div className="space-y-3">
            {label && (
                <Label className="text-sm font-medium">{label}</Label>
            )}
            
            <div className="flex flex-col gap-2">
                {/* Operator selector */}
                {showOperator && (
                    <Select
                        value={operator}
                        onValueChange={(value) => onOperatorChange(value as FilterOperators['text'])}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select operator..." />
                        </SelectTrigger>
                        <SelectContent>
                            {operators.map((op) => (
                                <SelectItem key={op} value={op}>
                                    {FILTER_OPERATORS_LABELS.text[op]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Value input - only show if operator needs a value */}
                {needsValue && (
                    <Input
                        type="text"
                        value={internalValue}
                        onChange={(e) => handleValueChange(e.target.value)}
                        onBlur={(e) => handleImmediateChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="w-full"
                    />
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
 * Compact text filter for use in filter chips
 */
export function CompactTextFilter({
    value,
    operator,
    onValueChange,
    placeholder = "Type...",
    disabled = false
}: Pick<TextFilterProps, 'value' | 'operator' | 'onValueChange' | 'placeholder' | 'disabled'>) {
    const [internalValue, setInternalValue] = useState(value)

    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const handleChange = useCallback((newValue: string) => {
        setInternalValue(newValue)
        const timeoutId = setTimeout(() => {
            onValueChange(newValue)
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [onValueChange])

    const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator)

    if (!needsValue) {
        return (
            <span className="text-xs text-muted-foreground">
                {operator === 'isEmpty' ? 'is empty' : 'is not empty'}
            </span>
        )
    }

    return (
        <Input
            type="text"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="h-6 text-xs"
        />
    )
} 