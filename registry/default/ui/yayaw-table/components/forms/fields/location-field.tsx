"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useTranslations } from "../../../providers/table-provider";
import { LocationEditor } from "../../location/location-editor";
import type { FormFieldApi, LocationFieldDefinition } from "../types";

interface LocationFieldProps<TFieldValues extends Record<string, unknown>> {
  field: LocationFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<unknown>;
}

/** A place: address search with the host's geocoder, name and coordinates. */
export function LocationField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: LocationFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const inputId = useId();
  const errors = fieldApi.state.meta.errors;
  const messages = Array.isArray(errors)
    ? errors.map((error) => (typeof error === "string" ? error : String(error)))
    : [];
  const label = field.labelKey ? t(field.labelKey) : field.label;
  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <LocationEditor
        disabled={field.disabled === true}
        inputId={inputId}
        invalid={!fieldApi.state.meta.isValid}
        label={typeof label === "string" ? label : undefined}
        onChange={(value) => fieldApi.handleChange(value)}
        value={fieldApi.state.value}
      />
      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}
      <FieldError errors={messages.map((message) => ({ message }))} />
    </Field>
  );
}
