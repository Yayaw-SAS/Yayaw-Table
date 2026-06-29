"use client";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslations } from "../../../providers/table-provider";
import type { FormFieldApi, RadioFieldDefinition } from "../types";

interface RadioFieldProps<TFieldValues extends Record<string, unknown>> {
  field: RadioFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<string | number | null>;
}

function getOptionId(name: string, value: number | string, index: number) {
  const safeValue = String(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${name}-${index}-${safeValue}`;
}

export function RadioField<TFieldValues extends Record<string, unknown>>({
  field,
  fieldApi,
}: RadioFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const value = fieldApi.state.value;
  const radioValue = value == null || value === "" ? "" : String(value);

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
      <RadioGroup
        aria-invalid={!fieldApi.state.meta.isValid}
        disabled={field.disabled}
        onValueChange={(nextValue) =>
          fieldApi.handleChange(
            nextValue == null || nextValue === "" ? null : nextValue
          )
        }
        value={radioValue}
      >
        {field.options.map((option, index) => {
          const optionValue = String(option.value);
          const optionId = getOptionId(fieldApi.name, option.value, index);

          return (
            <div className="flex items-center gap-2" key={optionValue}>
              <RadioGroupItem
                disabled={field.disabled}
                id={optionId}
                value={optionValue}
              />
              <FieldLabel className="font-normal" htmlFor={optionId}>
                {field.optionKeys?.[index]
                  ? t(field.optionKeys[index])
                  : option.label}
              </FieldLabel>
            </div>
          );
        })}
      </RadioGroup>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
