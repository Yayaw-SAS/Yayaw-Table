/**
 * Hook for using form configurations from the catalogue
 */
"use client"
import { useCallback } from "react"
import type { FieldValues, UseFormProps } from "react-hook-form"
import { z } from "zod"

import { useFormConfig, useTableActions } from "../../../providers/table-provider"
import type { AnyFieldDefinition, FormConfig } from "../types"

import { useFormBuilder } from "./use-form-builder"

export interface UseFormCatalogueOptions<TFieldValues extends FieldValues> {
    /**
     * Additional form options
     */
    formOptions?: Omit<UseFormProps<TFieldValues>, "defaultValues" | "resolver">

    /**
     * Type of form to use (corresponds to a key in the form catalogue)
     */
    formType: string

    /**
     * Initial data for the form (used for update operations)
     */
    initialData?: Partial<TFieldValues>

    /**
     * Mode of the form (create or update)
     */
    mode?: "create" | "update"
}

/**
 * Hook for using form configurations from the catalogue
 * @param options Hook options
 * @returns Form builder result
 */
export function useFormCatalogue<TFieldValues extends FieldValues>({
    formOptions,
    formType,
    initialData,
    mode = "create"
}: UseFormCatalogueOptions<TFieldValues>) {
    // Get the configuration helpers from the provider
    const getFormConfig = useFormConfig()
    const getTableActions = useTableActions()

    // Get the form configuration from the catalogue
    const config = getFormConfig?.<TFieldValues>(formType) || {
        id: formType,
        fields: [],
        defaultValues: {} as Partial<TFieldValues>,
        schema: z.any() as z.ZodType<TFieldValues>,
        translations: {
            namespace: "common",
            keys: {}
        }
    } as FormConfig<TFieldValues>

    // Use the form builder with the configuration
    const { fields, form, translations } = useFormBuilder<TFieldValues>({
        config,
        formOptions,
        initialData
    })

    // Get the table actions for this form type
    const actions = getTableActions?.(formType) || {}

    // Handle form submission
    const handleSubmit = useCallback(
        async (values: TFieldValues) => {
            try {
                let result: { success: boolean; data?: unknown; error?: string }

                // Sanitize values before submission
                const sanitizedValues = Object.entries(values).reduce(
                    (acc, [key, value]) => {
                        // Find the field definition to check its type
                        const fieldDef = config?.fields?.find((f: AnyFieldDefinition<TFieldValues>) => f.name === key)

                        if (fieldDef) {
                            // Handle JSON fields
                            if (
                                fieldDef.type === "value-type" &&
                                fieldDef.supportedTypes?.includes("json") &&
                                typeof value === "string"
                            ) {
                                try {
                                    acc[key] = JSON.parse(value)
                                } catch {
                                    acc[key] = value // Keep as string if parsing fails
                                }
                            }
                            // Handle boolean fields (ensure they're actual booleans)
                            else if (fieldDef.type === "checkbox") {
                                acc[key] = Boolean(value)
                            } else {
                                acc[key] = value
                            }
                        } else {
                            acc[key] = value
                        }
                        return acc
                    },
                    {} as Record<string, unknown>
                )

                // For update operations, merge with initial data and handle null JSON fields properly
                let dataToSubmit = sanitizedValues
                if (mode === "update" && initialData) {
                    // Merge the sanitized form values with the initial data
                    dataToSubmit = {
                        ...(initialData as Record<string, unknown>),
                        ...sanitizedValues
                    }

                    // Remove null JSON fields entirely - this prevents validation errors
                    // and lets Prisma handle the fields appropriately
                    for (const key of Object.keys(dataToSubmit)) {
                        if (dataToSubmit[key] === null) {
                            // For JSON fields, omit them entirely if they're null
                            if (
                                key === "options" ||
                                key === "value" ||
                                key === "config" ||
                                key === "metadata"
                            ) {
                                delete dataToSubmit[key]
                            }
                        }
                    }
                }

                // Use the appropriate action based on the mode
                if (mode === "update" && actions.update) {
                    // For update, we need the ID from the values or initialData
                    let id: string

                    // Try to get ID from values first
                    if ("id" in values) {
                        id = String(values.id)
                    }
                    // Then try to get ID from initialData if available
                    else if (initialData && "id" in initialData) {
                        id = String((initialData as Record<string, unknown>).id)
                    }
                    // If no ID is found, throw an error
                    else {
                        throw new Error(`ID not found for update operation on ${formType}`)
                    }

                    // Create a clean copy of the data without the ID for the update operation
                    const updateData = { ...dataToSubmit }
                    if ("id" in updateData) {
                        ;(updateData as Record<string, unknown>).id = undefined
                    }

                    result = await actions.update(id, updateData as Record<string, unknown>)
                } else if (mode === "create" && actions.create) {
                    result = await actions.create(sanitizedValues as Record<string, unknown>)
                } else {
                    throw new Error(`Action ${mode} not available for ${formType}`)
                }

                if (!result.success) {
                    throw new Error(result.error || `Failed to ${mode} ${formType}`)
                }

                return result.data
            } catch (error) {
                console.error(
                    `Error ${mode === "update" ? "updating" : "submitting"} ${formType} form:`,
                    error
                )
                throw error
            }
        },
        [formType, mode, actions, initialData, config?.fields]
    )

    return {
        fields,
        form,
        handleSubmit,
        translations
    }
}
