"use client";

import { Field, FieldError, FieldLabel } from "@/ui/shadcn/field";
import { Textarea } from "@/ui/shadcn/textarea";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, TextareaFieldDefinition } from "../types";

interface TextareaFieldProps {
  field: TextareaFieldDefinition;
  fieldApi: FormFieldApi<string>;
}

export function TextareaField({ field, fieldApi }: TextareaFieldProps) {
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
      <Textarea
        aria-invalid={!fieldApi.state.meta.isValid}
        className="min-h-[100px]"
        name={fieldApi.name}
        onBlur={fieldApi.handleBlur}
        onChange={(e) => fieldApi.handleChange(e.target.value)}
        placeholder={
          field.placeholderKey ? t(field.placeholderKey) : field.placeholder
        }
        value={String(fieldApi.state.value ?? "")}
      />
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
