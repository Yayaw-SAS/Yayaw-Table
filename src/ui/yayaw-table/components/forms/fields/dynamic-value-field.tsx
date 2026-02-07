/**
 * Dynamic value field component for forms
 * Renders different form fields based on a specified type
 */
"use client";

// Debug flag to control logging
const DEBUG = false;

/**
 * Convert value to boolean type
 */
function convertToBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const stringValue = String(value).toLowerCase();
    return stringValue === "true" || stringValue === "1";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return Boolean(value);
}

/**
 * Convert value to number type
 */
function convertToNumber(value: unknown): unknown {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

/**
 * Convert value to JSON string
 */
function convertToJson(value: unknown): unknown {
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_e) {
      // Ignore JSON stringify errors
    }
  }
  return value;
}

/**
 * Convert value to string type
 */
function convertToString(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }
  try {
    return String(value);
  } catch (_e) {
    // Ignore string conversion errors
    return value;
  }
}

/**
 * Convert value to appropriate type
 */
function convertValueToType(value: unknown, type: string): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  switch (type) {
    case "boolean":
      return convertToBoolean(value);
    case "number":
      return convertToNumber(value);
    case "json":
      return convertToJson(value);
    case "string":
      return convertToString(value);
    default:
      return value;
  }
}

import type { UseFormReturn } from "react-hook-form";

import type {
  AnyFieldDefinition,
  CheckboxFieldDefinition,
  NumberFieldDefinition,
  TextareaFieldDefinition,
  TextFieldDefinition,
} from "../types";

import { NumberField } from "./number-field";
import { SwitchField } from "./switch-field";
import { TextField } from "./text-field";
import { TextareaField } from "./textarea-field";

interface DynamicValueFieldProps {
  field: AnyFieldDefinition;
  form: UseFormReturn<Record<string, unknown>>;
  type: "boolean" | "json" | "number" | "string";
}

/**
 * Get the initial value from field or form
 */
function getInitialFieldValue(
  field: AnyFieldDefinition,
  form: UseFormReturn<Record<string, unknown>>
): unknown {
  const fieldWithValue = field as AnyFieldDefinition & { value?: unknown };
  return fieldWithValue.value !== undefined
    ? fieldWithValue.value
    : form.getValues(field.name);
}

/**
 * Search for the correct value in form values
 */
function searchFormValuesForCorrectValue(
  formValues: Record<string, unknown>,
  field: AnyFieldDefinition,
  type: string
): unknown | null {
  // Check if formValues contains the expected name/key with a different value than the type
  for (const [key, val] of Object.entries(formValues)) {
    if (key === field.name && val !== type) {
      if (DEBUG) {
        // DEBUG: Value type mismatch detected
      }
      return val;
    }
  }
  return null;
}

/**
 * Fix value type mismatch issues
 */
function fixValueTypeMismatch(
  currentValue: unknown,
  type: string,
  field: AnyFieldDefinition,
  form: UseFormReturn<Record<string, unknown>>
): unknown {
  // Fix a common bug: Detect if the currentValue is the same as the valueType - likely indicating we got the wrong value
  // In this case, we should attempt to get the real value from the form
  if (typeof currentValue === "string" && currentValue === type) {
    // Try to get the real value from the form's formValues instead
    const formValues = form.getValues();
    if (DEBUG) {
      // DEBUG: Form values extracted
    }

    if (formValues && typeof formValues === "object") {
      const correctValue = searchFormValuesForCorrectValue(
        formValues,
        field,
        type
      );
      if (correctValue !== null) {
        return correctValue;
      }
    }
  }

  return currentValue;
}

/**
 * Get the current value for a dynamic field, handling edge cases
 */
function getCurrentFieldValue(
  field: AnyFieldDefinition,
  form: UseFormReturn<Record<string, unknown>>,
  type: string
): unknown {
  // Get the current value - prioritize field.value (from baseFieldProps) if present
  let currentValue = getInitialFieldValue(field, form);

  // Fix value type mismatch issues
  currentValue = fixValueTypeMismatch(currentValue, type, field, form);

  if (DEBUG) {
    // DEBUG: Processing dynamic value field
  }

  // Always ensure value is appropriate for the field type
  return convertValueToType(currentValue, type);
}

export function DynamicValueField({
  field,
  form,
  type,
}: DynamicValueFieldProps) {
  // Get the field registration from react-hook-form
  const fieldRegistration = form.register(field.name);

  // Get the current value using helper
  const currentValue = getCurrentFieldValue(field, form, type);

  if (DEBUG) {
    // DEBUG: Field props prepared
  }

  // Create base field props with the current value
  const baseFieldProps = {
    name: fieldRegistration.name,
    onBlur: fieldRegistration.onBlur,
    onChange: (value: unknown) => {
      if (DEBUG) {
        // DEBUG: Field value changed
      }
      form.setValue(field.name, value);
    },
    ref: fieldRegistration.ref,
    value: currentValue,
  };

  if (DEBUG) {
    // DEBUG: Starting field rendering
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
              variant: "switch",
            } as CheckboxFieldDefinition
          }
          form={form}
        />
      );
    case "json":
      return (
        <TextareaField
          field={
            {
              ...field,
              ...baseFieldProps,
              type: "textarea",
            } as TextareaFieldDefinition
          }
          form={form}
        />
      );
    case "number":
      return (
        <NumberField
          field={
            {
              ...field,
              ...baseFieldProps,
              type: "number",
            } as NumberFieldDefinition
          }
          form={form}
        />
      );
    default:
      if (DEBUG) {
        // DEBUG: Default field case
      }
      return (
        <TextField
          field={
            { ...field, ...baseFieldProps, type: "text" } as TextFieldDefinition
          }
          form={form}
        />
      );
  }
}
