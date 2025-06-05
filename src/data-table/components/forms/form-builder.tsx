/**
 * Form builder component
 * This component renders a form based on field definitions
 */
"use client"

// Debug flag to control logging
const DEBUG = false

import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { useTranslations } from "../../providers/table-provider"
import { type ReactNode, useEffect } from "react"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import {
    CheckboxField,
    DynamicValueField,
    NumberField,
    SelectField,
    SelectWithAddNewField,
    SwitchField,
    TextField,
    TextareaField,
    ValueTypeField
} from "./fields"
import type { AnyFieldDefinition, DynamicValueFieldDefinition } from "./types"

interface FormBuilderProps<TFieldValues extends FieldValues> {
    /**
     * Additional actions to render in the form footer
     */
    actions?: ReactNode

    /**
     * Additional class name for the form
     */
    className?: string

    /**
     * Whether to disable the form
     */
    disabled?: boolean

    /**
     * Field definitions
     */
    fields: AnyFieldDefinition<TFieldValues>[]

    /**
     * Form instance
     */
    form: UseFormReturn<TFieldValues>

    /**
     * Whether the form is submitting
     */
    isSubmitting?: boolean

    /**
     * Form submission handler
     */
    onSubmit: (values: TFieldValues) => Promise<void> | void

    /**
     * Submit button text
     * If set to null, the submit button will not be rendered
     */
    submitText?: null | string
}

/**
 * Interface for dynamic field updates
 */
interface DynamicFieldUpdate {
    name: string
    value: unknown
}

/**
 * Interface for dynamic field updates map on window
 */
interface WindowWithDynamicUpdates extends Window {
    __dynamicFieldUpdates?: Map<string, DynamicFieldUpdate>
}

/**
 * Form builder component
 * Renders a form based on field definitions
 */
export function FormBuilder<TFieldValues extends FieldValues>({
    actions,
    className,
    disabled = false,
    fields,
    form,
    isSubmitting = false,
    onSubmit,
    submitText
}: FormBuilderProps<TFieldValues>) {
    // Setup dependencies for fields that depend on other fields
    useEffect(() => {
        if (DEBUG) {
            console.log("[FormBuilder] Setting up dependencies for fields:", fields)
        }

        // Filter fields that have dependencies (only DynamicValueFieldDefinition has dependsOn)
        const fieldsWithDependencies = fields.filter(
            (field): field is DynamicValueFieldDefinition<TFieldValues> =>
                field.type === "dynamic-value" && "dependsOn" in field
        )

        if (fieldsWithDependencies.length === 0) {
            return
        }

        if (DEBUG) {
            console.log("[FormBuilder] Fields with dependencies:", fieldsWithDependencies)
        }

        // Set up dependencies for fields
        const subscriptions = fieldsWithDependencies.map((field) => {
            const dependencyField = field.dependsOn.field as Path<TFieldValues>

            // Get the current value of the dependency field - for DynamicValueField
            // we only need to watch for changes, not set initial values
            const fieldName = field.name as string
            const fieldType = field.type
            const isValueField = fieldName === "value"
            const isDynamicValueField = fieldType === "dynamic-value"

            // Only apply transform to non-dynamic-value fields
            // For dynamic-value fields, the transform is only used to determine the field type
            if (!isDynamicValueField && !isValueField) {
                const currentValue = form.getValues(dependencyField)

                // If there's an initial value, apply the transform
                if (currentValue) {
                    try {
                        const transformedValue = field.dependsOn.transform(currentValue)

                        // Only set the value if it's different from the current value
                        const currentFieldValue = form.getValues(field.name as Path<TFieldValues>)
                        if (transformedValue !== currentFieldValue) {
                            form.setValue(
                                field.name,
                                transformedValue as TFieldValues[Path<TFieldValues>],
                                {
                                    shouldDirty: false,
                                    shouldValidate: false
                                }
                            )
                        }
                    } catch (error) {
                        console.error(`Error transforming field ${field.name}:`, error)
                    }
                }
            }

            // Subscribe to changes in the dependency field
            const subscription = form.watch((formValues, { name, type }) => {
                // Only process if the changed field is our dependency
                if (name === dependencyField && type === "change" && formValues) {
                    try {
                        const dependencyValue = formValues[dependencyField]
                        if (dependencyValue !== undefined) {
                            // Apply the transform function to the dependency value
                            const transformedValue = field.dependsOn.transform(dependencyValue)

                            // For dynamic-value fields, we don't want to set their value to the transformed value
                            // since the transform is only used to determine the field type
                            if (!isDynamicValueField && !isValueField) {
                                // Update the dependent field
                                form.setValue(
                                    field.name,
                                    transformedValue as TFieldValues[Path<TFieldValues>],
                                    {
                                        shouldDirty: true,
                                        shouldValidate: true
                                    }
                                )
                            }
                        }
                    } catch (error) {
                        console.error(`Error transforming field ${field.name}:`, error)
                    }
                }
            })

            return subscription
        })

        // Clean up subscriptions when component unmounts
        return () => {
            for (const subscription of subscriptions) {
                if (subscription && typeof subscription.unsubscribe === "function") {
                    subscription.unsubscribe()
                }
            }
        }
    }, [form, fields])

    // Effect to process dynamic field value updates after render
    // This addresses the "Cannot update component during render" error
    useEffect(() => {
        const windowWithUpdates = window as WindowWithDynamicUpdates
        const dynamicFieldUpdates = windowWithUpdates.__dynamicFieldUpdates
        if (dynamicFieldUpdates && dynamicFieldUpdates.size > 0) {
            // Process each update after render is complete
            for (const update of dynamicFieldUpdates.values()) {
                try {
                    if (DEBUG) {
                        console.log(
                            `[FormBuilder] Applying delayed update for ${update.name}:`,
                            typeof update.value === "object"
                                ? JSON.stringify(update.value)
                                : update.value
                        )
                    }

                    form.setValue(
                        update.name as Path<TFieldValues>,
                        update.value as TFieldValues[Path<TFieldValues>],
                        {
                            shouldDirty: false
                        }
                    )
                } catch (error) {
                    console.error(`[FormBuilder] Error updating field ${update.name}:`, error)
                }
            }

            // Clear the updates after processing
            dynamicFieldUpdates.clear()
        }
    })

    // Get translations
    const { t } = useTranslations()

    // Render a field based on its type
    const renderField = (field: AnyFieldDefinition<TFieldValues>) => {
        // Get the field registration from react-hook-form
        const fieldRegistration = form.register(field.name)

        // Create base field props
        const baseFieldProps = {
            name: fieldRegistration.name,
            onBlur: fieldRegistration.onBlur,
            onChange: (value: unknown) =>
                form.setValue(field.name, value as TFieldValues[Path<TFieldValues>]),
            ref: fieldRegistration.ref,
            value: form.getValues(field.name)
        }

        switch (field.type) {
            case "checkbox":
                return <CheckboxField field={{ ...field, ...baseFieldProps }} form={form} />
            case "custom":
                return field.renderField({ field: baseFieldProps, form })
            case "dynamic-value": {
                // Directly watch the field value for real-time updates
                const valueType = form.watch(field.dependsOn?.field as Path<TFieldValues>)
                const transformedType = field.dependsOn?.transform(valueType)

                // Get current value for this field
                const dynamicFieldValue = form.getValues(field.name)

                if (DEBUG) {
                    console.log(
                        "[FormBuilder] Dynamic value field details:",
                        JSON.stringify(
                            {
                                currentValue: dynamicFieldValue,
                                dependsOnField: field.dependsOn?.field,
                                dependsOnValue: valueType,
                                fieldName: field.name,
                                transformedType
                            },
                            null,
                            2
                        )
                    )
                }

                if (
                    !transformedType ||
                    typeof transformedType !== "string" ||
                    !["boolean", "json", "number", "string"].includes(transformedType)
                ) {
                    console.warn(`Invalid value type: ${transformedType}`)
                    return null
                }

                // We'll use a ref to record if value needs update,
                // and let the useEffect at the component level handle it
                const windowWithUpdates = window as WindowWithDynamicUpdates
                if (!windowWithUpdates.__dynamicFieldUpdates) {
                    windowWithUpdates.__dynamicFieldUpdates = new Map()
                }

                // Skip value conversion during render to avoid React errors
                // Store the needed conversion in a global map that will be processed by a useEffect
                if (dynamicFieldValue !== undefined) {
                    let convertedValue: unknown = dynamicFieldValue
                    let needsConversion = false

                    if (transformedType === "boolean" && typeof dynamicFieldValue !== "boolean") {
                        // Convert to boolean
                        if (typeof dynamicFieldValue === "string") {
                            const stringValue = String(dynamicFieldValue).toLowerCase()
                            convertedValue = stringValue === "true" || stringValue === "1"
                            needsConversion = true
                        } else if (typeof dynamicFieldValue === "number") {
                            convertedValue = dynamicFieldValue !== 0
                            needsConversion = true
                        }
                    } else if (
                        transformedType === "number" &&
                        typeof dynamicFieldValue !== "number"
                    ) {
                        // Convert to number
                        if (
                            typeof dynamicFieldValue === "string" &&
                            !Number.isNaN(Number(dynamicFieldValue))
                        ) {
                            convertedValue = Number(dynamicFieldValue)
                            needsConversion = true
                        }
                    } else if (transformedType === "json") {
                        // Convert to JSON string if needed
                        if (typeof dynamicFieldValue === "object" && dynamicFieldValue !== null) {
                            try {
                                convertedValue = JSON.stringify(dynamicFieldValue, null, 2)
                                needsConversion = true
                            } catch (e) {
                                console.error("[FormBuilder] Failed to stringify object:", e)
                            }
                        }
                    } else if (
                        transformedType === "string" &&
                        typeof dynamicFieldValue !== "string"
                    ) {
                        // Convert to string
                        try {
                            convertedValue = String(dynamicFieldValue)
                            needsConversion = true
                        } catch (e) {
                            console.error("[FormBuilder] Failed to convert to string:", e)
                        }
                    }

                    // Record conversion for later processing by useEffect
                    if (needsConversion) {
                        windowWithUpdates.__dynamicFieldUpdates!.set(field.name as string, {
                            name: field.name as string,
                            value: convertedValue
                        })
                    }
                }

                if (DEBUG) {
                    console.log(
                        "[FormBuilder] Render value for value:",
                        form.getValues(field.name),
                        `(${transformedType})`
                    )
                }

                // Return the dynamic field with the computed type
                return (
                    <DynamicValueField
                        field={field}
                        form={form as UseFormReturn<Record<string, unknown>>}
                        type={transformedType as "boolean" | "json" | "number" | "string"}
                    />
                )
            }
            case "number":
                return (
                    <NumberField
                        field={{ ...field, ...baseFieldProps }}
                        form={form as UseFormReturn<Record<string, unknown>>}
                    />
                )
            case "select":
                return <SelectField field={{ ...field, ...baseFieldProps }} form={form} />
            case "select-with-add-new":
                return (
                    <SelectWithAddNewField
                        field={{ ...field, ...baseFieldProps }}
                        form={form as UseFormReturn<Record<string, unknown>>}
                        items={field.options?.map((option) => String(option.value)) || []}
                        label={field.label}
                        name={field.name.toString()}
                        optionsLoader={field.optionsLoader}
                        placeholder={field.placeholder}
                    />
                )
            case "switch":
                return (
                    <SwitchField
                        field={{
                            ...field,
                            ...baseFieldProps,
                            type: "checkbox",
                            variant: "switch"
                        }}
                        form={form as UseFormReturn<Record<string, unknown>>}
                    />
                )
            case "text":
                if (typeof field === "object" && field !== null) {
                    return (
                        <TextField
                            field={{ ...field, ...baseFieldProps }}
                            form={form as UseFormReturn<Record<string, unknown>>}
                        />
                    )
                }
                console.warn(`Invalid field type for string: ${typeof field}`)
                return null
            case "textarea":
                return (
                    <TextareaField
                        field={{ ...field, ...baseFieldProps }}
                        form={form as UseFormReturn<Record<string, unknown>>}
                    />
                )
            case "value-type":
                return (
                    <ValueTypeField
                        description={field.description}
                        field={baseFieldProps}
                        form={form as UseFormReturn<Record<string, unknown>>}
                        label={field.label}
                        placeholder={field.placeholder}
                        valueType={form.getValues(field.valueTypeField)}
                    />
                )
            default: {
                const unknownField = field as { type: string }
                console.warn(`Unknown field type: ${unknownField.type}`)
                return null
            }
        }
    }

    return (
        <Form {...form}>
            <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-4">
                    {fields.map((field) => (
                        <div key={field.name.toString()}>{renderField(field)}</div>
                    ))}
                </div>

                {submitText !== null && (
                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">{actions}</div>
                        {submitText && (
                            <Button disabled={disabled || isSubmitting} type="submit">
                                {t(submitText)}
                            </Button>
                        )}
                    </div>
                )}
            </form>
        </Form>
    )
}
