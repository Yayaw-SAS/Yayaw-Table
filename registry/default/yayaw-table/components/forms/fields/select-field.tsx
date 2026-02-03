/**
 * Select field component for forms
 */
"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "../../../providers/table-provider";

import type { SelectFieldDefinition } from "../types";

interface SelectFieldProps<TFieldValues extends FieldValues> {
  /**
   * Field definition
   */
  field: SelectFieldDefinition<TFieldValues>;

  /**
   * Form instance
   */
  form: UseFormReturn<TFieldValues>;
}

/**
 * Select field component
 */
export function SelectField<TFieldValues extends FieldValues>({
  field,
  form,
}: SelectFieldProps<TFieldValues>) {
  const { t } = useTranslations();

  return (
    <FormField
      control={form.control}
      name={field.name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>
            {field.labelKey ? t(field.labelKey) : field.label}
          </FormLabel>
          <FormControl>
            <Select
              defaultValue={formField.value}
              disabled={field.disabled}
              onValueChange={formField.onChange}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    field.placeholderKey
                      ? t(field.placeholderKey)
                      : field.placeholder
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option, index) => (
                  <SelectItem
                    key={String(option.value)}
                    value={String(option.value)}
                  >
                    {field.optionKeys?.[index]
                      ? t(field.optionKeys[index])
                      : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          {field.description && (
            <FormDescription>
              {field.descriptionKey
                ? t(field.descriptionKey)
                : field.description}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
