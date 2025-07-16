/**
 * Form definition helpers
 * These functions help define form configurations
 */
import type { FieldValues } from 'react-hook-form'
import type { z } from 'zod'

import type { AnyFieldDefinition, FormConfig } from './types'

/**
 * Default form translations
 */
export const defaultFormTranslations = {
    keys: {
        cancel: 'cancel',
        create: 'create',
        'createForm.description': 'create_form.description',
        'createForm.title': 'create_form.title',
        error: 'error',
        errorDescription: 'error_description',
        submit: 'submit',
        success: 'success',
        successDescription: 'success_description'
    },
    namespace: 'common'
}

/**
 * Define a form configuration
 * @param config Form configuration
 * @returns Complete form configuration with defaults
 */
export function defineFormConfig<TFieldValues extends FieldValues = FieldValues>(config: {
    /**
     * Default values for the form
     */
    defaultValues: Partial<TFieldValues>

    /**
     * Field definitions
     */
    fields: AnyFieldDefinition<TFieldValues>[]

    /**
     * Form ID
     */
    id: string

    /**
     * Schema for form validation
     */
    schema: z.ZodType<TFieldValues>

    /**
     * Translation configuration
     */
    translations?: Partial<FormConfig<TFieldValues>['translations']>
}): FormConfig<TFieldValues> {
    // Merge translations with defaults
    const translations = {
        ...defaultFormTranslations,
        ...config.translations
    }

    return {
        defaultValues: config.defaultValues,
        fields: config.fields,
        id: config.id,
        schema: config.schema,
        translations
    }
}
