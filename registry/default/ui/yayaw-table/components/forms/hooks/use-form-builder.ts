"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "../../../providers/table-provider";
import {
  formValuesEqual,
  initialFormValues,
  translateFormConfig,
  validateForm,
} from "../form-runtime";
import type {
  AnyFieldDefinition,
  FieldValues,
  FormConfig,
  FormConfigContext,
} from "../types";

export interface UseFormBuilderOptions<TFieldValues extends FieldValues> {
  config: FormConfig<TFieldValues>;
  context?: FormConfigContext;
  formOptions?: { onSubmit?: (values: TFieldValues) => void | Promise<void> };
  initialData?: Partial<TFieldValues>;
  onValuesChange?: (values: TFieldValues) => void;
}

/** Keep the TanStack public API while using the same validation semantics as Vue. */
export function useFormBuilder<TFieldValues extends FieldValues>({
  config,
  context,
  formOptions = {},
  initialData,
  onValuesChange,
}: UseFormBuilderOptions<TFieldValues>) {
  const { t } = useTranslations();
  const latest = useRef({ config, context, formOptions });
  latest.current = { config, context, formOptions };
  const submitted = useRef<{
    input: FieldValues;
    values: FieldValues;
    errors: Record<string, string>;
  } | null>(null);
  const previousInitial = useRef(initialData);
  const defaultValues = useMemo(
    () => initialFormValues(config as FormConfig, initialData) as TFieldValues,
    [config, initialData]
  );
  const runtimeContext = (values: FieldValues): FormConfigContext => ({
    formType: config.id,
    tableId: config.id,
    tableType: config.id,
    mode: "create",
    ...latest.current.context,
    values,
  });
  const form = useForm({
    defaultValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result = await validateForm(
          latest.current.config as FormConfig,
          value,
          runtimeContext(value)
        );
        submitted.current = { input: value, ...result };
        return Object.keys(result.errors).length
          ? {
              form: Object.values(result.errors).join("; "),
              fields: result.errors,
            }
          : undefined;
      },
      onBlurAsync: async ({ value, formApi }) => {
        // TanStack also runs blur validators during submit; the submit validator owns that pass.
        if (formApi.state.isSubmitting) {
          return undefined;
        }
        const result = await validateForm(
          latest.current.config as FormConfig,
          value,
          runtimeContext(value)
        );
        return Object.keys(result.errors).length
          ? {
              form: Object.values(result.errors).join("; "),
              fields: result.errors,
            }
          : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      const result =
        submitted.current && formValuesEqual(submitted.current.input, value)
          ? submitted.current
          : await validateForm(
              latest.current.config as FormConfig,
              value,
              runtimeContext(value)
            );
      if (!Object.keys(result.errors).length) {
        await latest.current.formOptions.onSubmit?.(
          result.values as TFieldValues
        );
      }
    },
  });
  const values = useStore(form.store, (state) => state.values as TFieldValues);
  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);
  useEffect(() => {
    if (!formValuesEqual(previousInitial.current, initialData)) {
      previousInitial.current = initialData;
      form.reset(
        initialFormValues(
          latest.current.config as FormConfig,
          initialData
        ) as TFieldValues
      );
    }
  }, [form, initialData]);
  const translated = translateFormConfig(config as FormConfig);
  const fields = translated.fields.map((field) => ({
    ...field,
    label:
      field.labelKey && !config.translations?.keys[field.labelKey]
        ? t(field.labelKey)
        : field.label,
  })) as AnyFieldDefinition<TFieldValues>[];
  return {
    form,
    fields,
    sections: translated.sections ?? [],
    context: { ...runtimeContext(values), values },
    translations: {
      submit: "Save",
      update: "Save",
      cancel: "Cancel",
      create: "Create",
      created: "Created",
      updated: "Updated",
      ...config.translations?.keys,
    } as Record<string, string>,
  };
}

export type FormBuilderFormInstance<TFieldValues extends FieldValues> =
  ReturnType<typeof useFormBuilder<TFieldValues>>["form"];
