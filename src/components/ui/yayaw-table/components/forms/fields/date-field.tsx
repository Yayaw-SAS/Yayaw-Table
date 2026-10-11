"use client";

import { useId } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { FormDateField } from "../../../form/form-date-field";
import { useTranslations } from "../../../providers/table-provider";
import { formLabel } from "../../../utils/form-view";
import { dataTypeDateInput } from "../../../utils/table-contracts";
import {
  dateTimeFromInput,
  dateTimeInputValue,
} from "../../../utils/value-format";
import type { DateFieldDefinition, FormFieldApi } from "../types";

interface DateFieldProps<TFieldValues extends Record<string, unknown>> {
  field: DateFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<Date | string | null>;
}

/**
 * A date of a record form: the Form view's popover calendar, reading in the
 * table's language and storing `YYYY-MM-DD` (empty when cleared). With
 * `withTime`, a date and time input in `timeZone` (the viewer's without one)
 * storing an ISO 8601 instant.
 */
export function DateField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: DateFieldProps<TFieldValues>) {
  const { locale, t } = useTranslations();
  const controlId = useId();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const language = locale ?? "en";
  const placeholder = field.placeholderKey
    ? t(field.placeholderKey)
    : field.placeholder;

  const label = field.labelKey ? t(field.labelKey) : field.label;
  const description =
    field.description != null ? (
      <FieldDescription>
        {field.descriptionKey ? t(field.descriptionKey) : field.description}
      </FieldDescription>
    ) : null;

  if (field.withTime) {
    return (
      <Field data-invalid={!fieldApi.state.meta.isValid}>
        <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
        <Input
          aria-invalid={!fieldApi.state.meta.isValid}
          data-date-time-field=""
          disabled={field.disabled === true}
          id={controlId}
          lang={language}
          max={dateTimeInputValue(field.maxDate, field.timeZone) || undefined}
          min={dateTimeInputValue(field.minDate, field.timeZone) || undefined}
          name={fieldApi.name}
          onBlur={fieldApi.handleBlur}
          onChange={(event) =>
            fieldApi.handleChange(
              dateTimeFromInput(event.target.value, field.timeZone) ?? ""
            )
          }
          required={field.required}
          type="datetime-local"
          value={dateTimeInputValue(fieldApi.state.value, field.timeZone)}
        />
        {description}
        <FieldError errors={errorMessages.map((message) => ({ message }))} />
      </Field>
    );
  }

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel htmlFor={controlId} id={`${controlId}-label`}>
        {label}
      </FieldLabel>
      <FormDateField
        clearLabel={formLabel("clearDate", language)}
        disabled={field.disabled === true}
        id={controlId}
        invalid={!fieldApi.state.meta.isValid}
        labelId={`${controlId}-label`}
        locale={language}
        max={dataTypeDateInput(field.maxDate) || undefined}
        min={dataTypeDateInput(field.minDate) || undefined}
        onChange={(value) => {
          fieldApi.handleChange(value);
          fieldApi.handleBlur();
        }}
        placeholder={placeholder ?? formLabel("pickDate", language)}
        required={field.required}
        value={dataTypeDateInput(fieldApi.state.value)}
      />
      {description}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
