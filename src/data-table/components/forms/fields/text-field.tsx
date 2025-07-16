/**
 * Text field component for forms
 */
'use client'

import type { FieldValues, UseFormReturn } from 'react-hook-form'
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useTranslations } from '../../../providers/table-provider'

import type { TextFieldDefinition } from '../types'

interface TextFieldProps<TFieldValues extends FieldValues> {
    /**
     * Field definition
     */
    field: TextFieldDefinition<TFieldValues>

    /**
     * Form instance
     */
    form: UseFormReturn<TFieldValues>
}

/**
 * Text field component
 */
export function TextField<TFieldValues extends FieldValues>({
    field,
    form
}: TextFieldProps<TFieldValues>) {
    const { t } = useTranslations()

    return (
        <FormField
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
                <FormItem>
                    <FormLabel>{field.labelKey ? t(field.labelKey) : field.label}</FormLabel>
                    <FormControl>
                        <Input
                            disabled={field.disabled}
                            placeholder={
                                field.placeholderKey ? t(field.placeholderKey) : field.placeholder
                            }
                            {...formField}
                        />
                    </FormControl>
                    {field.description && (
                        <FormDescription>
                            {field.descriptionKey ? t(field.descriptionKey) : field.description}
                        </FormDescription>
                    )}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
