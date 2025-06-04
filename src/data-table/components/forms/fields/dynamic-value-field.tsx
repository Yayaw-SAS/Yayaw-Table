/**
 * Dynamic value field component for forms
 * Renders different form fields based on a specified type
 */
"use client"

// Debug flag to control logging
const DEBUG = false

import type { UseFormReturn } from "react-hook-form"

import type {
    AnyFieldDefinition,
    CheckboxFieldDefinition,
    NumberFieldDefinition,
    TextFieldDefinition,
    TextareaFieldDefinition
} from "../types"

import { NumberField } from "./number-field"
import { SwitchField } from "./switch-field"
import { TextField } from "./text-field"
import { TextareaField } from "./textarea-field"

interface DynamicValueFieldProps {
    field: AnyFieldDefinition
    form: UseFormReturn<Record<string, unknown>>
    type: "boolean" | "json" | "number" | "string"
}

export function DynamicValueField({ field, form, type }: DynamicValueFieldProps) {
    // Get the field registration from react-hook-form
    const fieldRegistration = form.register(field.name)

    // Get the current value - prioritize field.value (from baseFieldProps) if present
    const fieldWithValue = field as AnyFieldDefinition & { value?: unknown }
    let currentValue =
        fieldWithValue.value !== undefined ? fieldWithValue.value : form.getValues(field.name)

    // Fix a common bug: Detect if the currentValue is the same as the valueType - likely indicating we got the wrong value
    // In this case, we should attempt to get the real value from the form
    if (typeof currentValue === "string" && currentValue === type) {
        // Try to get the real value from the form's formValues instead
        const formValues = form.getValues()
        if (DEBUG) {
            console.log(
                "[DynamicValueField] Detected value same as type, checking form values:",
                JSON.stringify(formValues, null, 2)
            )
        }

        if (formValues && typeof formValues === "object") {
            // Check if formValues contains the expected name/key with a different value than the type
            for (const [key, val] of Object.entries(formValues)) {
                if (key === field.name && val !== type) {
                    if (DEBUG) {
                        console.log(
                            `[DynamicValueField] Found better value for ${field.name}:`,
                            val
                        )
                    }
                    currentValue = val
                }
            }
        }
    }

    if (DEBUG) {
        console.log(
            "[DynamicValueField] Initial value:",
            JSON.stringify(
                {
                    currentValue,
                    fieldName: field.name,
                    type
                },
                null,
                2
            )
        )
    }

    // Always ensure value is appropriate for the field type
    if (currentValue !== undefined && currentValue !== null) {
        if (type === "boolean" && typeof currentValue !== "boolean") {
            if (typeof currentValue === "string") {
                const stringValue = String(currentValue).toLowerCase()
                currentValue = stringValue === "true" || stringValue === "1"
            } else if (typeof currentValue === "number") {
                currentValue = currentValue !== 0
            }
        } else if (type === "number" && typeof currentValue !== "number") {
            if (typeof currentValue === "string" && !Number.isNaN(Number(currentValue))) {
                currentValue = Number(currentValue)
            }
        } else if (type === "json") {
            if (typeof currentValue === "object" && currentValue !== null) {
                try {
                    currentValue = JSON.stringify(currentValue, null, 2)
                } catch (e) {
                    console.error("[DynamicValueField] Failed to stringify object:", e)
                }
            }
        } else if (type === "string" && typeof currentValue !== "string") {
            try {
                currentValue = String(currentValue)
            } catch (e) {
                console.error("[DynamicValueField] Failed to convert to string:", e)
            }
        }
    }

    if (DEBUG) {
        console.log(
            "[DynamicValueField] Processed value:",
            JSON.stringify(
                {
                    processedValue: currentValue,
                    type: typeof currentValue
                },
                null,
                2
            )
        )
    }

    // Create base field props with the current value
    const baseFieldProps = {
        name: fieldRegistration.name,
        onBlur: fieldRegistration.onBlur,
        onChange: (value: unknown) => {
            if (DEBUG) {
                console.log(
                    `[DynamicValueField] ${field.name} changed to:`,
                    typeof value === "object" ? JSON.stringify(value) : value
                )
            }
            form.setValue(field.name, value)
        },
        ref: fieldRegistration.ref,
        value: currentValue
    }

    if (DEBUG) {
        console.log(
            "[DynamicValueField] Field props for rendering:",
            JSON.stringify(
                {
                    fieldName: field.name,
                    fieldType: type,
                    fieldValue: baseFieldProps.value
                },
                null,
                2
            )
        )
    }

    switch (type) {
        case "boolean":
            return (
                <SwitchField
                    field={
                        {
                            ...field,
                            ...baseFieldProps,
                            type: "checkbox",
                            variant: "switch"
                        } as CheckboxFieldDefinition
                    }
                    form={form}
                />
            )
        case "json":
            return (
                <TextareaField
                    field={
                        {
                            ...field,
                            ...baseFieldProps,
                            type: "textarea"
                        } as TextareaFieldDefinition
                    }
                    form={form}
                />
            )
        case "number":
            return (
                <NumberField
                    field={
                        {
                            ...field,
                            ...baseFieldProps,
                            type: "number"
                        } as NumberFieldDefinition
                    }
                    form={form}
                />
            )
        default:
            if (DEBUG) {
                console.log(
                    "[DynamicValueField] Rendering TextField with value:",
                    typeof baseFieldProps.value === "object"
                        ? JSON.stringify(baseFieldProps.value)
                        : baseFieldProps.value
                )
            }
            return (
                <TextField
                    field={{ ...field, ...baseFieldProps, type: "text" } as TextFieldDefinition}
                    form={form}
                />
            )
    }
}
