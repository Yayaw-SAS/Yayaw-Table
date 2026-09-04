/**
 * Multi-select field component for forms (TanStack Form + Field)
 */
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, MultiSelectFieldDefinition } from "../types";

type MultiSelectOptionValue = boolean | number | string;

interface MultiSelectFieldProps<TFieldValues extends Record<string, unknown>> {
  field: MultiSelectFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<MultiSelectOptionValue[]>;
}

function getOptionId(
  name: string,
  value: MultiSelectOptionValue,
  index: number
) {
  const safeValue = String(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${name}-${index}-${safeValue}`;
}

export function normalizeMultiSelectFieldValue(
  value: unknown
): MultiSelectOptionValue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is MultiSelectOptionValue =>
      typeof item === "number" ||
      typeof item === "string" ||
      typeof item === "boolean"
  );
}

export function toggleMultiSelectFieldValue(input: {
  currentValue: unknown;
  optionValue: MultiSelectOptionValue;
  options: readonly { value: MultiSelectOptionValue }[];
}): MultiSelectOptionValue[] {
  const selected = new Set(
    normalizeMultiSelectFieldValue(input.currentValue).map((value) =>
      String(value)
    )
  );
  const optionKey = String(input.optionValue);
  if (selected.has(optionKey)) {
    selected.delete(optionKey);
  } else {
    selected.add(optionKey);
  }

  return input.options
    .filter((option) => selected.has(String(option.value)))
    .map((option) => option.value);
}

export function MultiSelectField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: MultiSelectFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const value = normalizeMultiSelectFieldValue(fieldApi.state.value);
  const selectedValues = new Set(value.map((item) => String(item)));

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>
        {field.labelKey ? t(field.labelKey) : field.label}
      </FieldLabel>
      {field.description != null && (
        <FieldDescription>
          {field.descriptionKey ? t(field.descriptionKey) : field.description}
        </FieldDescription>
      )}
      <div
        aria-invalid={!fieldApi.state.meta.isValid}
        className="grid gap-2 rounded-md border p-3"
      >
        {(Array.isArray(field.options) ? field.options : []).map(
          (option, index) => {
            const optionId = getOptionId(fieldApi.name, option.value, index);
            const optionValue = String(option.value);

            return (
              <div className="flex items-center gap-2" key={optionValue}>
                <Checkbox
                  checked={selectedValues.has(optionValue)}
                  disabled={field.disabled === true || option.disabled}
                  id={optionId}
                  onCheckedChange={() =>
                    fieldApi.handleChange(
                      toggleMultiSelectFieldValue({
                        currentValue: fieldApi.state.value,
                        optionValue: option.value,
                        options: Array.isArray(field.options)
                          ? field.options
                          : [],
                      })
                    )
                  }
                />
                <FieldLabel className="font-normal" htmlFor={optionId}>
                  {field.optionKeys?.[index]
                    ? t(field.optionKeys[index])
                    : option.label}
                </FieldLabel>
              </div>
            );
          }
        )}
      </div>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
