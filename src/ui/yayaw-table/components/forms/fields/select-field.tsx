/**
 * Select field component for forms (TanStack Form + Field)
 */
"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/ui/shadcn/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, SelectFieldDefinition } from "../types";

interface SelectFieldProps<TFieldValues extends Record<string, unknown>> {
  field: SelectFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<string | number | null>;
}

export function SelectField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: SelectFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const value = fieldApi.state.value;
  const selectValue = value == null || value === "" ? null : String(value);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      <Select
        disabled={field.disabled}
        onValueChange={(val) =>
          fieldApi.handleChange(val == null || val === "" ? null : val)
        }
        value={selectValue}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              field.placeholderKey ? t(field.placeholderKey) : field.placeholder
            }
          />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option, index) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {field.optionKeys?.[index]
                ? t(field.optionKeys[index])
                : option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
