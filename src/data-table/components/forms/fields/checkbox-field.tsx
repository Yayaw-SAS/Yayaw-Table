/**
 * Checkbox field component for forms
 */
"use client"

import { Checkbox } from "@/components/ui/checkbox"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import { useTranslations } from "../../../providers/table-provider"
import type { FieldValues, UseFormReturn } from "react-hook-form"

import type { CheckboxFieldDefinition } from "../types"

interface CheckboxFieldProps<TFieldValues extends FieldValues> {
    /**
     * Field definition
     */
    field: CheckboxFieldDefinition<TFieldValues>

    /**
     * Form instance
     */
    form: UseFormReturn<TFieldValues>
}

/**
 * Checkbox field component
 */
export function CheckboxField<TFieldValues extends FieldValues>({
    field,
    form
}: CheckboxFieldProps<TFieldValues>) {
    const { t } = useTranslations()

    return (
        <FormField
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox
                            checked={formField.value}
                            disabled={field.disabled}
                            onCheckedChange={formField.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>{field.labelKey ? t(field.labelKey) : field.label}</FormLabel>
                        {field.description && (
                            <FormDescription>
                                {field.descriptionKey ? t(field.descriptionKey) : field.description}
                            </FormDescription>
                        )}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
