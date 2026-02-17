/**
 * Form builder hook
 * This hook creates a form instance based on a form configuration (TanStack Form)
 */
"use client";

import { useForm } from "@tanstack/react-form";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "../../../providers/table-provider";

import type {
  AnyFieldDefinition,
  FieldValues,
  FormConfig,
  SelectFieldDefinition,
} from "../types";

export interface UseFormBuilderOptions<TFieldValues extends FieldValues> {
  config: FormConfig<TFieldValues>;
  formOptions?: {
    onSubmit?: (values: TFieldValues) => void | Promise<void>;
  };
  initialData?: Partial<TFieldValues>;
}

/**
 * Form builder hook
 * @param options - Hook options
 * @returns Form instance and fields
 */
export function useFormBuilder<TFieldValues extends FieldValues>({
  config,
  formOptions = {},
  initialData,
}: UseFormBuilderOptions<TFieldValues>) {
  const { t } = useTranslations();
  const prevInitialDataRef = useRef<Partial<TFieldValues> | undefined>(
    undefined
  );
  const formResetInProgressRef = useRef(false);

  const defaultValues = useMemo(() => {
    return initialData
      ? { ...(config.defaultValues as TFieldValues), ...initialData }
      : (config.defaultValues as TFieldValues);
  }, [config.defaultValues, initialData]);

  const form = useForm({
    defaultValues,
    validators: {
      // Zod schema is a standard schema at runtime; this cast avoids a generic
      // input/output mismatch from Zod's type signature.
      onSubmit: config.schema as never,
    },
    onSubmit: formOptions.onSubmit
      ? ({ value }) => {
          formOptions.onSubmit?.(value as TFieldValues);
        }
      : undefined,
  });

  useEffect(() => {
    if (
      initialData &&
      !formResetInProgressRef.current &&
      JSON.stringify(initialData) !== JSON.stringify(prevInitialDataRef.current)
    ) {
      formResetInProgressRef.current = true;
      const newDefaultValues = {
        ...(config.defaultValues as TFieldValues),
        ...initialData,
      };
      form.reset(newDefaultValues);
      prevInitialDataRef.current = initialData;
      setTimeout(() => {
        formResetInProgressRef.current = false;
      }, 10);
    }
  }, [initialData, config.defaultValues, form]);

  const translateField = useCallback(
    (
      field: AnyFieldDefinition<TFieldValues>
    ): AnyFieldDefinition<TFieldValues> => {
      if (field.labelKey) {
        return { ...field, label: t(field.labelKey) };
      }
      if (field.descriptionKey) {
        return { ...field, description: t(field.descriptionKey) };
      }
      if (field.placeholderKey) {
        return { ...field, placeholder: t(field.placeholderKey) };
      }
      if (field.type === "select") {
        const selectField = field as SelectFieldDefinition<TFieldValues>;
        const optionKeys = selectField.optionKeys;
        if (optionKeys?.length) {
          return {
            ...selectField,
            options: selectField.options.map((option, index) => ({
              label:
                index < optionKeys.length ? t(optionKeys[index]) : option.label,
              value: option.value,
            })),
          };
        }
      }
      return field;
    },
    [t]
  );

  const fields = useMemo(
    () =>
      config.fields.map(translateField) as AnyFieldDefinition<TFieldValues>[],
    [config.fields, translateField]
  );

  const translations = useMemo(() => {
    return Object.entries(config.translations.keys).reduce(
      (acc, [key, value]) => {
        acc[key] = t(value);
        return acc;
      },
      {} as Record<string, string>
    );
  }, [config.translations.keys, t]);

  return {
    fields,
    form,
    translations,
  };
}

/** Form instance type returned by useFormBuilder (TanStack Form API) */
export type FormBuilderFormInstance<TFieldValues extends FieldValues> =
  ReturnType<typeof useFormBuilder<TFieldValues>>["form"];
