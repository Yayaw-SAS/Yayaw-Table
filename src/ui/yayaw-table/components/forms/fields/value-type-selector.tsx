"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/shadcn/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { useTranslations } from "../../../providers/table-provider";

import type { ValueType } from "./value-type-field";

export interface ValueTypeSelectorProps {
  description?: string;
  field: {
    onChange: (value: unknown) => void;
    value: unknown;
  };
  form: UseFormReturn<Record<string, unknown>>;
  label: string;
  onValueTypeChange?: (valueType: ValueType) => void;
  placeholder?: string;
}

export function ValueTypeSelector({
  description,
  field,
  form: _form,
  label,
  onValueTypeChange,
  placeholder,
}: ValueTypeSelectorProps) {
  const { t } = useTranslations();

  const valueTypes: { label: string; value: ValueType }[] = [
    { label: t("value_types.boolean"), value: "boolean" },
    { label: t("value_types.number"), value: "number" },
    { label: t("value_types.string"), value: "string" },
    { label: t("value_types.json"), value: "json" },
  ];

  const handleValueTypeChange = (value: string) => {
    field.onChange(value);
    onValueTypeChange?.(value as ValueType);
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {description && <FormDescription>{description}</FormDescription>}
      <FormControl>
        <Select
          onValueChange={(value) =>
            value != null ? handleValueTypeChange(value) : undefined
          }
          value={String(field.value || "string")}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={placeholder || t("value_types.select_placeholder")}
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
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
