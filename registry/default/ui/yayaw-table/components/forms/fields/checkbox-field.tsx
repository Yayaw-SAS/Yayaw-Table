/**
 * Checkbox field component for forms (TanStack Form + Field)
 */
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useTranslations } from "../../../providers/table-provider";
import type { CheckboxFieldDefinition, FormFieldApi } from "../types";

interface CheckboxFieldProps<TFieldValues extends Record<string, unknown>> {
  field: CheckboxFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<boolean>;
}

export function CheckboxField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: CheckboxFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const checked = Boolean(fieldApi.state.value);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <Checkbox
          checked={checked}
          disabled={field.disabled}
          id={fieldApi.name}
          onCheckedChange={(val) => fieldApi.handleChange(Boolean(val))}
        />
        <div className="space-y-1 leading-none">
          <FieldLabel htmlFor={fieldApi.name}>
            {field.labelKey ? t(field.labelKey) : field.label}
          </FieldLabel>
          {field.description != null && (
            <FieldDescription>
              {field.descriptionKey
                ? t(field.descriptionKey)
                : field.description}
            </FieldDescription>
          )}
        </div>
      </div>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
