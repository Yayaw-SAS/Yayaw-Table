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

import type { FormFieldApi } from "../types";
import type { ValueType } from "./value-type-field";

export interface ValueTypeSelectorProps {
  description?: string;
  fieldApi: FormFieldApi<string>;
  label: string;
  onValueTypeChange?: (valueType: ValueType) => void;
  placeholder?: string;
}

export function ValueTypeSelector({
  description,
  fieldApi,
  label,
  onValueTypeChange,
  placeholder,
}: ValueTypeSelectorProps) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  const valueTypes: { label: string; value: ValueType }[] = [
    { label: t("value_types.boolean"), value: "boolean" },
    { label: t("value_types.number"), value: "number" },
    { label: t("value_types.string"), value: "string" },
    { label: t("value_types.json"), value: "json" },
  ];

  const handleValueTypeChange = (value: string) => {
    fieldApi.handleChange(value);
    onValueTypeChange?.(value as ValueType);
  };

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>{label}</FieldLabel>
      {description != null && (
        <FieldDescription>{description}</FieldDescription>
      )}
      <Select
        onValueChange={(v) =>
          v != null ? handleValueTypeChange(v) : undefined
        }
        value={String(fieldApi.state.value ?? "string")}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={placeholder ?? t("value_types.select_placeholder")}
          />
        </SelectTrigger>
        <SelectContent>
          {valueTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
