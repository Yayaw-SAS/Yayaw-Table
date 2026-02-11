"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, NumberFieldDefinition } from "../types";

interface NumberFieldProps {
  field: NumberFieldDefinition;
  fieldApi: FormFieldApi<number | string>;
}

export function NumberField({ field, fieldApi }: NumberFieldProps) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const value = fieldApi.state.value;
  const displayValue =
    value === undefined || value === null ? "" : String(value);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}
      <Input
        aria-invalid={!fieldApi.state.meta.isValid}
        disabled={field.disabled}
        max={field.max}
        min={field.min}
        name={fieldApi.name}
        onBlur={fieldApi.handleBlur}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            fieldApi.handleChange("");
            return;
          }
          const num = Number.parseFloat(raw);
          fieldApi.handleChange(Number.isNaN(num) ? raw : num);
        }}
        placeholder={
          field.placeholderKey ? t(field.placeholderKey) : field.placeholder
        }
        step={field.step}
        type="number"
        value={displayValue}
      />
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
