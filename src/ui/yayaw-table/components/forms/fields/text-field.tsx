/**
 * Text field component for forms (TanStack Form + Field)
 */
"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, TextFieldDefinition } from "../types";

interface TextFieldProps<TFieldValues extends Record<string, unknown>> {
  field: TextFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<string>;
}

export function TextField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: TextFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      <Input
        aria-invalid={!fieldApi.state.meta.isValid}
        disabled={field.disabled}
        name={fieldApi.name}
        onBlur={fieldApi.handleBlur}
        onChange={(e) => fieldApi.handleChange(e.target.value)}
        placeholder={
          field.placeholderKey ? t(field.placeholderKey) : field.placeholder
        }
        value={fieldApi.state.value ?? ""}
      />
      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
