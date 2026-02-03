/**
 * Form builder hook
 * This hook creates a form instance based on a form configuration
 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  useForm,
} from "react-hook-form";
import type { z } from "zod";
import { useTranslations } from "../../../providers/table-provider";

import type {
  AnyFieldDefinition,
  FormConfig,
  SelectFieldDefinition,
} from "../types";

export interface UseFormBuilderOptions<TFieldValues extends FieldValues> {
  /**
   * Form configuration
   */
  config: FormConfig<TFieldValues>;

  /**
   * Additional form options
   */
  formOptions?: Omit<UseFormProps<TFieldValues>, "defaultValues" | "resolver">;

  /**
   * Initial data for the form (used for update operations)
   * This will override the default values from the config
   */
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
  // Get translations for the form
  const { t } = useTranslations();

  // Use refs to track previous values and prevent unnecessary resets
  const prevInitialDataRef = useRef<Partial<TFieldValues> | undefined>(
    undefined
  );
  const formResetInProgressRef = useRef(false);

  // Merge default values with initial data if provided
  const defaultValues = useMemo(() => {
    return initialData
      ? {
          ...(config.defaultValues as DefaultValues<TFieldValues>),
          ...initialData,
        }
      : (config.defaultValues as DefaultValues<TFieldValues>);
  }, [config.defaultValues, initialData]);

  // Create a form instance with the schema and default values
  // Cast schema via unknown for compatibility between zod v3/v4 and @hookform/resolvers
  const resolver = zodResolver(
    config.schema as unknown as Parameters<typeof zodResolver>[0]
  ) as unknown as Resolver<TFieldValues, unknown>;
  const form = useForm<TFieldValues>({
    defaultValues,
    resolver,
    ...formOptions,
  });

  // Reset form with new default values when initialData changes
  // This ensures that react-hook-form correctly tracks dirty fields
  useEffect(() => {
    // Only reset if initialData actually changed and we're not already resetting
    if (
      initialData &&
      !formResetInProgressRef.current &&
      JSON.stringify(initialData) !== JSON.stringify(prevInitialDataRef.current)
    ) {
      formResetInProgressRef.current = true;

      const newDefaultValues = {
        ...(config.defaultValues as DefaultValues<TFieldValues>),
        ...initialData,
      };

      // Reset the form with the new default values
      // This will update both the form values and the baseline for dirty field detection
      form.reset(newDefaultValues);

      // Update the ref to track the current initialData
      prevInitialDataRef.current = initialData;

      // Reset the flag after a brief delay
      setTimeout(() => {
        formResetInProgressRef.current = false;
      }, 10);
    }
  }, [initialData, config.defaultValues, form]);

  // Helper function to translate a single field
  const translateField = useCallback(
    (
      field: AnyFieldDefinition<TFieldValues>
    ): AnyFieldDefinition<TFieldValues> => {
      // If the field has a translation key, translate it
      if (field.labelKey) {
        return {
          ...field,
          label: t(field.labelKey),
        };
      }

      // If the field has a description translation key, translate it
      if (field.descriptionKey) {
        return {
          ...field,
          description: t(field.descriptionKey),
        };
      }

      // If the field has a placeholder translation key, translate it
      if (field.placeholderKey) {
        return {
          ...field,
          placeholder: t(field.placeholderKey),
        };
      }

      // If the field is a select field with option translation keys, translate them
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

  // Get translated fields
  const fields = useMemo(() => {
    return config.fields.map(
      translateField
    ) as AnyFieldDefinition<TFieldValues>[];
  }, [config.fields, translateField]);

  // Get translated form translations
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
