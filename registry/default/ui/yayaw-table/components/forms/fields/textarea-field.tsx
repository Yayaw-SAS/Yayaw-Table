"use client";

import { useId } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "../../../providers/table-provider";
import { jsonFormDraft, jsonFormText } from "../../../utils/table-contracts";
import type { FormFieldApi, TextareaFieldDefinition } from "../types";

interface TextareaFieldProps {
  field: TextareaFieldDefinition;
  fieldApi: FormFieldApi<unknown>;
}

export function TextareaField({ field, fieldApi }: TextareaFieldProps) {
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
      <Textarea
        aria-invalid={!fieldApi.state.meta.isValid}
        className="min-h-[100px]"
        disabled={field.disabled === true}
        id={controlId}
        name={fieldApi.name}
        onBlur={fieldApi.handleBlur}
        onChange={(e) =>
          fieldApi.handleChange(
            field.type === "json"
              ? jsonFormDraft(e.target.value)
              : e.target.value
          )
        }
        placeholder={
          field.placeholderKey ? t(field.placeholderKey) : field.placeholder
        }
        rows={field.rows}
        value={
          field.type === "json"
            ? jsonFormText(fieldApi.state.value)
            : String(fieldApi.state.value ?? "")
        }
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
