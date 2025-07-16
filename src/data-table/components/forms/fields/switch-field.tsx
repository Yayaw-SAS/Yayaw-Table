'use client'

import type { UseFormReturn } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { useTranslations } from '../../../providers/table-provider'

import type { CheckboxFieldDefinition } from '../types'

interface SwitchFieldProps {
    field: CheckboxFieldDefinition
    form: UseFormReturn<Record<string, unknown>>
}

export function SwitchField({ field, form }: SwitchFieldProps) {
    const { t } = useTranslations()

    return (
        <FormField
            control={form.control}
            name={field.name}
            render={({ field: formField }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>{field.labelKey ? t(field.labelKey) : field.label}</FormLabel>
                    </div>
                    <FormControl>
                        <Switch
                            checked={Boolean(formField.value)}
                            onCheckedChange={formField.onChange}
                        />
                    </FormControl>
                </FormItem>
            )}
        />
    )
}
