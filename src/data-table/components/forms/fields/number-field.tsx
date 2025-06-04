"use client"

import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useTranslations } from "../../../providers/table-provider"
import type { UseFormReturn } from "react-hook-form"

import type { NumberFieldDefinition } from "../types"

interface NumberFieldProps {
    field: NumberFieldDefinition
    form: UseFormReturn<Record<string, unknown>>
}

export function NumberField({ field, form }: NumberFieldProps) {
    const { t } = useTranslations()

    return (
        <FormField
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
                <FormItem>
                    <FormLabel>{field.labelKey ? t(field.labelKey) : field.label}</FormLabel>
                    {field.description && (
                        <FormDescription>
                            {field.descriptionKey ? t(field.descriptionKey) : field.description}
                        </FormDescription>
                    )}
                    <FormControl>
                        <Input
                            {...formField}
                            disabled={field.disabled}
                            max={field.max}
                            min={field.min}
                            placeholder={
                                field.placeholderKey ? t(field.placeholderKey) : field.placeholder
                            }
                            step={field.step}
                            type="number"
                            value={formField.value ? String(formField.value) : ""}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
