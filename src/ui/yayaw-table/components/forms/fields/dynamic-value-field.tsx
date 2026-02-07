/**
 * Dynamic value field – renders different inputs based on type (TanStack Form + Field)
 */
"use client";

import type {
  AnyFieldDefinition,
  CheckboxFieldDefinition,
  FormFieldApi,
  NumberFieldDefinition,
  TextareaFieldDefinition,
  TextFieldDefinition,
} from "../types";

import { NumberField } from "./number-field";
import { SwitchField } from "./switch-field";
import { TextField } from "./text-field";
import { TextareaField } from "./textarea-field";
import { ValueTypeField } from "./value-type-field";

interface DynamicValueFieldProps {
  field: AnyFieldDefinition;
  fieldApi: FormFieldApi<unknown>;
  type: "boolean" | "json" | "number" | "string";
}

export function DynamicValueField({
  field,
  fieldApi,
  type,
}: DynamicValueFieldProps) {
  switch (type) {
    case "boolean":
      return (
        <SwitchField
          field={
            {
              ...field,
              type: "checkbox",
              variant: "switch",
            } as CheckboxFieldDefinition
          }
          fieldApi={fieldApi as FormFieldApi<boolean>}
        />
      );
    case "json":
      return (
        <TextareaField
          field={
            {
              ...field,
              type: "textarea",
            } as TextareaFieldDefinition
          }
          fieldApi={fieldApi as FormFieldApi<string>}
        />
      );
    case "number":
      return (
        <NumberField
          field={
            {
              ...field,
              type: "number",
            } as NumberFieldDefinition
          }
          fieldApi={fieldApi as FormFieldApi<number | string>}
        />
      );
    case "string":
      return (
        <TextField
          field={
            {
              ...field,
              type: "text",
            } as TextFieldDefinition
          }
          fieldApi={fieldApi as FormFieldApi<string>}
        />
      );
    default:
      return (
        <ValueTypeField
          fieldApi={fieldApi}
          label={field.label}
          valueType={type}
        />
      );
  }
}
