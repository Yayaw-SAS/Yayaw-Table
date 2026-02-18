/**
 * Form builder component (TanStack Form + Field)
 * Renders a form based on field definitions using form.Field for each field.
 */
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { useTranslations } from "../../providers/table-provider";
import {
  CheckboxField,
  DynamicValueField,
  NumberField,
  SelectField,
  SelectWithAddNewField,
  SwitchField,
  TextareaField,
  TextField,
  UrlField,
  ValueTypeField,
} from "./fields";
import type { FormBuilderFormInstance } from "./hooks/use-form-builder";
import type {
  AnyFieldDefinition,
  DynamicValueFieldDefinition,
  FieldValues,
  FormFieldApi,
  Path,
} from "./types";

interface FormBuilderProps<TFieldValues extends FieldValues> {
  actions?: ReactNode;
  className?: string;
  disabled?: boolean;
  fields: AnyFieldDefinition<TFieldValues>[];
  form: FormBuilderFormInstance<TFieldValues>;
  isSubmitting?: boolean;
  submitText?: null | string;
}

interface WindowWithDynamicUpdates extends Window {
  __dynamicFieldUpdates?: Map<string, { name: string; value: unknown }>;
}

function normalizeFieldApi<T>(field: {
  state: { value: T; meta: { errors: unknown[]; isValid: boolean } };
  handleChange: (value: T) => void;
  handleBlur: () => void;
  name: string;
}): FormFieldApi<T> {
  const errors = field.state.meta.errors;
  const errorStrings = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  return {
    handleBlur: field.handleBlur,
    handleChange: field.handleChange,
    name: field.name,
    state: {
      meta: { errors: errorStrings, isValid: field.state.meta.isValid },
      value: field.state.value,
    },
  };
}

function FormBuilderField<TFieldValues extends FieldValues>({
  field,
  form,
}: {
  field: AnyFieldDefinition<TFieldValues>;
  form: FormBuilderFormInstance<TFieldValues>;
}) {
  switch (field.type) {
    case "checkbox":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => {
            const normalizedFieldApi = normalizeFieldApi(
              f
            ) as unknown as FormFieldApi<boolean>;
            if (field.variant === "checkbox") {
              return (
                <CheckboxField field={field} fieldApi={normalizedFieldApi} />
              );
            }
            return (
              <SwitchField
                field={{ ...field, variant: "switch" }}
                fieldApi={normalizedFieldApi}
              />
            );
          }}
        </form.Field>
      );
    case "custom":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) =>
            field.renderField({
              field: normalizeFieldApi(f) as unknown as FormFieldApi<unknown>,
              form: {
                getFieldValue: (name) =>
                  form.getFieldValue(name as Path<TFieldValues>),
                setFieldValue: (name, value) =>
                  form.setFieldValue(
                    name as Path<TFieldValues>,
                    value as Parameters<
                      FormBuilderFormInstance<TFieldValues>["setFieldValue"]
                    >[1]
                  ),
              },
            })
          }
        </form.Field>
      );
    case "dynamic-value": {
      if (!("dependsOn" in field)) {
        return null;
      }
      const depField = field.dependsOn.field as Path<TFieldValues>;
      return (
        <form.Subscribe
          key={field.name}
          selector={(state) => state.values[depField]}
        >
          {(depValue: unknown) => {
            const transformed = field.dependsOn.transform(depValue);
            const type = transformed;
            if (
              typeof type !== "string" ||
              !["boolean", "json", "number", "string"].includes(type)
            ) {
              return null;
            }
            return (
              <form.Field name={field.name as Path<TFieldValues>}>
                {(f) => (
                  <DynamicValueField
                    field={field}
                    fieldApi={
                      normalizeFieldApi(f) as unknown as FormFieldApi<unknown>
                    }
                    type={type as "boolean" | "json" | "number" | "string"}
                  />
                )}
              </form.Field>
            );
          }}
        </form.Subscribe>
      );
    }
    case "number":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <NumberField
              field={
                field as AnyFieldDefinition<TFieldValues> & { type: "number" }
              }
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<
                  number | string
                >
              }
            />
          )}
        </form.Field>
      );
    case "select":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <SelectField
              field={field}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<
                  string | number | null
                >
              }
            />
          )}
        </form.Field>
      );
    case "select-with-add-new":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <SelectWithAddNewField
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<string | null>
              }
              items={field.options?.map((o) => String(o.value)) ?? []}
              label={field.label}
              name={field.name as string}
              optionsLoader={field.optionsLoader}
              placeholder={field.placeholder}
            />
          )}
        </form.Field>
      );
    case "switch":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <SwitchField
              field={{ ...field, type: "checkbox", variant: "switch" }}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<boolean>
              }
            />
          )}
        </form.Field>
      );
    case "text":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <TextField
              field={field}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<string>
              }
            />
          )}
        </form.Field>
      );
    case "textarea":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <TextareaField
              field={
                field as AnyFieldDefinition<TFieldValues> & {
                  type: "textarea";
                }
              }
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<string>
              }
            />
          )}
        </form.Field>
      );
    case "url":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <UrlField
              field={field}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<string>
              }
            />
          )}
        </form.Field>
      );
    case "value-type":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <form.Subscribe
              selector={(state) =>
                state.values[field.valueTypeField as Path<TFieldValues>]
              }
            >
              {(valueType: unknown) => (
                <ValueTypeField
                  description={field.description}
                  fieldApi={
                    normalizeFieldApi(f) as unknown as FormFieldApi<unknown>
                  }
                  label={field.label}
                  placeholder={field.placeholder}
                  valueType={
                    ((valueType as string) || "string") as
                      | "boolean"
                      | "json"
                      | "number"
                      | "string"
                  }
                />
              )}
            </form.Subscribe>
          )}
        </form.Field>
      );
    default:
      return null;
  }
}

export function FormBuilder<TFieldValues extends FieldValues>({
  actions,
  className,
  disabled = false,
  fields,
  form,
  isSubmitting = false,
  submitText,
}: FormBuilderProps<TFieldValues>) {
  const { t } = useTranslations();

  useEffect(() => {
    const fieldsWithDeps = fields.filter(
      (f): f is DynamicValueFieldDefinition<TFieldValues> =>
        f.type === "dynamic-value" && "dependsOn" in f
    );
    if (fieldsWithDeps.length === 0) {
      return;
    }

    const shouldTransform = (fieldName: string, fieldType: string) => {
      const isValueField = fieldName === "value";
      const isDynamic = fieldType === "dynamic-value";
      return !(isDynamic || isValueField);
    };

    for (const field of fieldsWithDeps) {
      const depField = field.dependsOn.field as Path<TFieldValues>;
      const currentVal = form.getFieldValue(depField);
      if (
        currentVal != null &&
        shouldTransform(field.name as string, field.type)
      ) {
        const transformed = field.dependsOn.transform(currentVal);
        if (typeof transformed === "string") {
          form.setFieldValue(
            field.name as Path<TFieldValues>,
            transformed as Parameters<
              FormBuilderFormInstance<TFieldValues>["setFieldValue"]
            >[1]
          );
        }
      }
    }
  }, [form, fields]);

  useEffect(() => {
    const win = window as WindowWithDynamicUpdates;
    const updates = win.__dynamicFieldUpdates;
    if (updates?.size) {
      for (const update of updates.values()) {
        try {
          form.setFieldValue(
            update.name as Path<TFieldValues>,
            update.value as Parameters<
              FormBuilderFormInstance<TFieldValues>["setFieldValue"]
            >[1]
          );
        } catch {
          // ignore
        }
      }
      updates.clear();
    }
  });

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={String(field.name)}>
            <FormBuilderField field={field} form={form} />
          </div>
        ))}
      </div>
      {submitText != null && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">{actions}</div>
          {submitText && (
            <Button disabled={disabled || isSubmitting} type="submit">
              {t(submitText)}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
