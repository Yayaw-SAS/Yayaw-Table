'use client'

// Debug flag to control logging
const DEBUG = false

import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
    FormControl,
    FormDescription,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { useTranslations } from '../../../providers/table-provider'

export interface SelectWithAddNewFieldProps {
    allowCreate?: boolean
    description?: string
    field: Record<string, unknown> & {
        onChange: (value: unknown) => void
        value: unknown
    }
    form: UseFormReturn<Record<string, unknown>>
    items?: string[]
    label: string
    name: string
    onItemsChange?: (items: string[]) => void
    optionsLoader?: () => Promise<string[]>
    placeholder?: string
}

/**
 * A form field component that combines a select dropdown with the ability to add new items.
 */
export function SelectWithAddNewField({
    allowCreate = true,
    description,
    field,
    form,
    items = [],
    label,
    name,
    onItemsChange,
    optionsLoader,
    placeholder
}: SelectWithAddNewFieldProps) {
    const { t } = useTranslations()
    const [showAddNew, setShowAddNew] = useState(false)
    const [newItem, setNewItem] = useState('')
    const [localItems, setLocalItems] = useState<string[]>([])
    const [selectKey, setSelectKey] = useState(0) // Used to force re-render of Select component
    // Use Tanstack Query to fetch options
    const { data: loadedItems = [], isLoading } = useQuery({
        enabled: !!optionsLoader,
        queryFn: async () => {
            if (DEBUG) {
            }

            if (optionsLoader) {
                try {
                    if (DEBUG) {
                    }
                    const options = await optionsLoader()
                    if (DEBUG) {
                    }
                    return options
                } catch (_error) {
                    return []
                }
            }
            if (DEBUG) {
            }
            return []
        },
        queryKey: [`select-options-${name}`],
        staleTime: 5 * 60 * 1000 // 5 minutes
    })

    // Log when component mounts
    useEffect(() => {
        if (DEBUG) {
        }
    }, [])

    // Combine all items: provided items, loaded items, and locally added ones
    const allItems = [...new Set([...items, ...loadedItems, ...localItems])]

    const handleAddNew = () => {
        if (!newItem.trim()) {
            return
        }

        const trimmedItem = newItem.trim()

        try {
            // Add to the local list if not already present
            if (!allItems.includes(trimmedItem)) {
                setLocalItems((prev) => [...prev, trimmedItem])

                // Notify parent component if callback is provided
                const updatedItems = [...items, trimmedItem]
                onItemsChange?.(updatedItems)
            }

            // Update the form value using multiple approaches to ensure it's properly set
            updateFormValue(trimmedItem)

            // Reset state but keep the value in the form
            setNewItem('')
            setShowAddNew(false)
        } catch (_error) {}
    }

    // Helper function to update form value using multiple approaches
    const updateFormValue = (value: string) => {
        // 1. Try to update using field.onChange if it exists and is a function
        try {
            if (field && typeof field.onChange === 'function') {
                field.onChange(value)
            } else {
                // Log warning but continue with other methods
                if (DEBUG) {
                }
            }
        } catch (_error) {}

        // 2. Set the value directly in the form state - this is the most reliable method
        try {
            form.setValue(name, value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true
            })
        } catch (_error) {}

        // 3. Update the field value directly if possible
        try {
            if (field) {
                field.value = value
            }
        } catch (_error) {}

        // 4. Force a state update to ensure the UI reflects the new value
        // This is needed because sometimes the Select component doesn't update visually
        setSelectKey((prev) => prev + 1)

        // 5. Log the current state for debugging
        if (DEBUG) {
        }

        // 6. Trigger validation
        try {
            form.trigger(name)
        } catch (_error) {}
    }

    const handleSelectChange = (value: string) => {
        if (value === 'add-new-item') {
            // Show the item addition interface
            setShowAddNew(true)
            return
        }

        // For all other values, update the form value
        try {
            updateFormValue(value)
        } catch (_error) {}
    }

    // Force validation on mount to ensure required fields are marked as such
    useEffect(() => {
        // Check if field exists and has a value property before accessing it
        const fieldValue = field && 'value' in field ? field.value : undefined

        // If the field is empty, trigger validation
        if (!fieldValue) {
            // Delay validation to avoid triggering it during initial render
            setTimeout(() => {
                try {
                    form.trigger(name)
                } catch (_error) {}
            }, 100)
        }
    }, [field, form, name])

    return (
        <FormItem>
            <FormLabel>
                {field.labelKey ? t(field.labelKey as string, { fallback: label }) : label}
            </FormLabel>
            {description && (
                <FormDescription>
                    {field.descriptionKey
                        ? t(field.descriptionKey as string, { fallback: description })
                        : description}
                </FormDescription>
            )}

            <FormControl>
                {showAddNew ? (
                    <div className="flex items-center space-x-2">
                        <Input
                            autoFocus
                            name={`new-${name}-input`}
                            onChange={(e) => {
                                // Update the local state with the input value
                                setNewItem(e.target.value)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    // Ensure the current input value is used when adding
                                    handleAddNew()
                                } else if (e.key === 'Escape') {
                                    setShowAddNew(false)
                                }
                            }}
                            placeholder={t('new_item_placeholder', { fallback: 'New item' })}
                            value={newItem}
                        />
                        <Button
                            data-testid={`add-${name}-button`}
                            onClick={handleAddNew}
                            size="sm"
                            type="button"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setShowAddNew(false)}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Select
                        defaultValue={(field?.value as string) || ''}
                        key={`select-${name}-${selectKey}`}
                        onOpenChange={(open) => {
                            // When closing the select without making a selection, trigger validation
                            if (!open) {
                                try {
                                    // Always trigger validation when closing the select
                                    form.trigger(name)
                                } catch (_error) {}
                            }
                        }}
                        onValueChange={handleSelectChange}
                        value={(form.getValues()[name] as string) || (field?.value as string) || ''}
                    >
                        <SelectTrigger>
                            <SelectValue
                                placeholder={
                                    field.placeholderKey
                                        ? t(field.placeholderKey as string, {
                                              fallback: placeholder || 'Select...'
                                          })
                                        : placeholder ||
                                          t('select_placeholder', { fallback: 'Select...' })
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {allItems.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                                {allowCreate && (
                                    <>
                                        <SelectSeparator />
                                        <SelectItem value="add-new-item">
                                            <span className="flex items-center">
                                                <Plus className="mr-2 h-4 w-4" />
                                                {t('categories.add_new', {
                                                    fallback: 'Add new'
                                                })}
                                            </span>
                                        </SelectItem>
                                    </>
                                )}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                )}
            </FormControl>

            <FormMessage />
        </FormItem>
    )
}
