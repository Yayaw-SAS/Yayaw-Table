/**
 * Select field component for forms (TanStack Form + Field)
 */
"use client";

import { useId } from "react";

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
import {
  optionControlKey,
  optionControlValue,
} from "../../../utils/table-contracts";
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
  const controlId = useId();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const value = fieldApi.state.value;
  const options = Array.isArray(field.options) ? [...field.options] : [];
  if (
    value != null &&
    value !== "" &&
    !options.some((option) => Object.is(option.value, value))
  ) {
    options.push({ label: String(value), value });
  }
  const selectValue =
    value == null ||
    (value === "" && !options.some((option) => option.value === ""))
      ? null
      : optionControlKey(value);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel htmlFor={controlId}>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      <Select
        items={options.map((option) => ({
          label: option.label,
          value: optionControlKey(option.value),
        }))}
        disabled={field.disabled === true}
        onValueChange={(val) =>
          fieldApi.handleChange(
            val == null
              ? null
              : (optionControlValue(val) as string | number | boolean)
          )
        }
        value={selectValue}
      >
        <SelectTrigger
          id={controlId}
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
          {options.map((option, index) => (
            <SelectItem
              disabled={option.disabled}
              key={optionControlKey(option.value)}
              value={optionControlKey(option.value)}
            >
              {field.optionKeys?.[index]
                ? t(field.optionKeys[index])
                : option.label}
            </SelectItem>
          ))}
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
