"use client";

import { useId } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { useTranslations } from "../../../providers/table-provider";
import type { DateFieldDefinition, FormFieldApi } from "../types";

import { dataTypeDateInput } from "../../../utils/table-contracts";

interface DateFieldProps<TFieldValues extends Record<string, unknown>> {
  field: DateFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<Date | string | null>;
}

const toDateInputValue = dataTypeDateInput;

export function DateField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: DateFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const controlId = useId();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel htmlFor={controlId}>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      <Input
        id={controlId}
        aria-invalid={!fieldApi.state.meta.isValid}
        disabled={field.disabled === true}
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
