/**
 * Select field component for forms (TanStack Form + Field)
 */
"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, SelectFieldDefinition } from "../types";
import { FormSelectContent } from "./form-select-content";

interface SelectFieldProps<TFieldValues extends Record<string, unknown>> {
  field: SelectFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<string | number | boolean | null>;
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
        disabled={field.disabled === true}
        onValueChange={(val) =>
          fieldApi.handleChange(
            val == null || val === ""
              ? null
              : ((Array.isArray(field.options) ? field.options : []).find(
                  (option) => String(option.value) === val
                )?.value ?? val)
          )
        }
        value={selectValue}
      >
        <SelectTrigger
          aria-label={field.labelKey ? t(field.labelKey) : field.label}
          onBlur={fieldApi.handleBlur}
        >
          <SelectValue
            placeholder={
              field.placeholderKey ? t(field.placeholderKey) : field.placeholder
            }
          />
        </SelectTrigger>
        <FormSelectContent>
          {(Array.isArray(field.options) ? field.options : []).map(
            (option, index) => (
              <SelectItem
                disabled={option.disabled}
                key={String(option.value)}
                value={String(option.value)}
              >
                {field.optionKeys?.[index]
                  ? t(field.optionKeys[index])
                  : option.label}
              </SelectItem>
            )
          )}
        </FormSelectContent>
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
