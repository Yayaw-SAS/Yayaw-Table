"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "../../../providers/table-provider";
import type { TranslationConfig } from "../atoms";
import type { FormFieldApi } from "../types";

export type ValueType = "boolean" | "json" | "number" | "string";

export interface ValueTypeFieldProps {
  description?: string;
  fieldApi: FormFieldApi<unknown>;
  label: string;
  placeholder?: string;
  translationConfig?: TranslationConfig;
  valueType: ValueType;
}

function coerceToBooleanType(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return Boolean(value);
}

function coerceToJsonType(value: unknown): unknown {
  if (typeof value === "object" && value !== null) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function coerceToNumberType(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (value === "") {
    return 0;
  }
  return Number(value);
}

export function coerceToType(value: unknown, type: ValueType): unknown {
  switch (type) {
    case "boolean":
      return coerceToBooleanType(value);
    case "json":
      return coerceToJsonType(value);
    case "number":
      return coerceToNumberType(value);
    case "string":
      return String(value || "");
    default:
      return value;
  }
}

export function ValueTypeField({
  description,
  fieldApi,
  label,
  placeholder,
  valueType,
}: ValueTypeFieldProps) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];

  const renderValueInput = () => {
    switch (valueType) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={fieldApi.state.value === true}
              onCheckedChange={(val) => fieldApi.handleChange(Boolean(val))}
            />
            <span className="text-muted-foreground text-sm">
              {fieldApi.state.value ? t("value.enabled") : t("value.disabled")}
            </span>
          </div>
        );
      case "json":
        return (
          <Textarea
            className="font-mono text-sm"
            onChange={(e) => {
              try {
                const value =
                  e.target.value.trim() === ""
                    ? {}
                    : JSON.parse(e.target.value);
                fieldApi.handleChange(value);
              } catch {
                // Keep invalid JSON in textarea
              }
            }}
            placeholder={placeholder ?? t("value.json_placeholder")}
            rows={5}
            value={(() => {
              const v = fieldApi.state.value;
              if (v === undefined) {
                return "";
              }
              if (typeof v === "object") {
                return JSON.stringify(v, null, 2);
              }
              return String(v);
            })()}
          />
        );
      case "number":
        return (
          <Input
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              fieldApi.handleChange(v);
            }}
            placeholder={placeholder ?? t("value.number_placeholder")}
            type="number"
            value={
              fieldApi.state.value === undefined
                ? ""
                : String(fieldApi.state.value)
            }
          />
        );
      default:
        return (
          <Input
            onChange={(e) => fieldApi.handleChange(e.target.value)}
            placeholder={placeholder ?? t("value.string_placeholder")}
            type="text"
            value={String(fieldApi.state.value ?? "")}
          />
        );
    }
  };

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>{label}</FieldLabel>
      {description != null && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {renderValueInput()}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
