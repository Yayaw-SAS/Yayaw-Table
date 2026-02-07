"use client";

import { Field, FieldError, FieldLabel } from "@/ui/shadcn/field";
import { Switch } from "@/ui/shadcn/switch";
import { useTranslations } from "../../../providers/table-provider";
import type { CheckboxFieldDefinition, FormFieldApi } from "../types";

interface SwitchFieldProps {
  field: CheckboxFieldDefinition;
  fieldApi: FormFieldApi<boolean>;
}

export function SwitchField({ field, fieldApi }: SwitchFieldProps) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
        <div className="space-y-0.5">
          <FieldLabel>
            {field.labelKey ? t(field.labelKey) : field.label}
          </FieldLabel>
        </div>
        <Switch
          checked={Boolean(fieldApi.state.value)}
          onCheckedChange={(val) => fieldApi.handleChange(Boolean(val))}
        />
      </div>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
