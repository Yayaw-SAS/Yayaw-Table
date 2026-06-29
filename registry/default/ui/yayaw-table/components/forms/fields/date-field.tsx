"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTranslations } from "../../../providers/table-provider";
import type { DateFieldDefinition, FormFieldApi } from "../types";

const DATE_INPUT_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

interface DateFieldProps<TFieldValues extends Record<string, unknown>> {
  field: DateFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<Date | string | null>;
}

function toDateInputValue(value: Date | string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : value.toISOString().slice(0, 10);
  }

  const dateMatch = value.match(DATE_INPUT_VALUE_PATTERN);
  if (dateMatch) {
    return dateMatch[0];
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

export function DateField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: DateFieldProps<TFieldValues>) {
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
        max={toDateInputValue(field.maxDate)}
        min={toDateInputValue(field.minDate)}
        name={fieldApi.name}
        onBlur={fieldApi.handleBlur}
        onChange={(event) => fieldApi.handleChange(event.target.value)}
        placeholder={
          field.placeholderKey ? t(field.placeholderKey) : field.placeholder
        }
        type="date"
        value={toDateInputValue(fieldApi.state.value)}
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
