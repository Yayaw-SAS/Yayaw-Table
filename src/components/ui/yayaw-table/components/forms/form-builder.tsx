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
  CollectionField,
  DateField,
  DynamicValueField,
  MultiSelectField,
  NumberField,
  RadioField,
  SelectField,
  SelectWithAddNewField,
  SwitchField,
  TextareaField,
  TextField,
  UrlField,
  ValueTypeField,
} from "./fields";
import { createCollectionFieldValidators } from "./fields/collection-field-utils";
import type { FormBuilderFormInstance } from "./hooks/use-form-builder";
import type {
  AnyFieldDefinition,
  CollectionFieldDefinition,
  DynamicValueFieldDefinition,
  FieldValues,
  FormFieldApi,
  FormSectionDefinition,
  Path,
} from "./types";

const DEFAULT_FORM_SECTION_ID = "__default";
const UNGROUPED_FORM_SECTION_ID = "__ungrouped";

interface FormBuilderProps<TFieldValues extends FieldValues> {
  actions?: ReactNode;
  className?: string;
  disabled?: boolean;
  fields: AnyFieldDefinition<TFieldValues>[];
  form: FormBuilderFormInstance<TFieldValues>;
  isSubmitting?: boolean;
  sections?: FormSectionDefinition<TFieldValues>[];
  submitText?: null | string;
}

export interface ResolvedFormBuilderSection<
  TFieldValues extends FieldValues = FieldValues,
> {
  description?: string;
  descriptionKey?: string;
  fields: AnyFieldDefinition<TFieldValues>[];
  id: string;
  isDefault?: boolean;
  isUngrouped?: boolean;
  title?: string;
  titleKey?: string;
}

interface WindowWithDynamicUpdates extends Window {
  __dynamicFieldUpdates?: Map<string, { name: string; value: unknown }>;
}

export function resolveFormBuilderSections<
  TFieldValues extends FieldValues = FieldValues,
>(input: {
  fields: AnyFieldDefinition<TFieldValues>[];
  sections?: FormSectionDefinition<TFieldValues>[];
}): ResolvedFormBuilderSection<TFieldValues>[] {
  if (!input.sections?.length) {
    return [
      {
        fields: input.fields,
        id: DEFAULT_FORM_SECTION_ID,
        isDefault: true,
      },
    ];
  }

  const fieldsByName = new Map(
    input.fields.map((field) => [String(field.name), field] as const)
  );
  const groupedFieldNames = new Set<string>();
  const resolvedSections: ResolvedFormBuilderSection<TFieldValues>[] = [];

  for (const section of input.sections) {
    const sectionFields = section.fields
      .map((fieldName) => fieldsByName.get(String(fieldName)))
      .filter((field): field is AnyFieldDefinition<TFieldValues> =>
        Boolean(field)
      );
    if (sectionFields.length === 0) {
      continue;
    }

    for (const field of sectionFields) {
      groupedFieldNames.add(String(field.name));
    }

    resolvedSections.push({
      description: section.description,
      descriptionKey: section.descriptionKey,
      fields: sectionFields,
      id: section.id,
      title: section.title,
      titleKey: section.titleKey,
    });
  }

  const ungroupedFields = input.fields.filter(
    (field) => !groupedFieldNames.has(String(field.name))
  );
  if (ungroupedFields.length > 0) {
    resolvedSections.push({
      fields: ungroupedFields,
      id: UNGROUPED_FORM_SECTION_ID,
      isUngrouped: true,
    });
  }

  if (resolvedSections.length === 0) {
    return [
      {
        fields: input.fields,
        id: DEFAULT_FORM_SECTION_ID,
        isDefault: true,
      },
    ];
  }

  return resolvedSections;
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
    case "collection": {
      const collectionValidators = createCollectionFieldValidators(field);

      return (
        <form.Field
          key={field.name}
          name={field.name as Path<TFieldValues>}
          validators={collectionValidators as never}
        >
          {(f) => (
            <CollectionField
              field={field as CollectionFieldDefinition<TFieldValues>}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<unknown>
              }
            />
          )}
        </form.Field>
      );
    }
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
    case "date":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <DateField
              field={field}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<
                  Date | string | null
                >
              }
            />
          )}
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
    case "multiSelect":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <MultiSelectField
              field={field}
              fieldApi={
                normalizeFieldApi(f) as unknown as FormFieldApi<
                  Array<number | string>
                >
              }
            />
          )}
        </form.Field>
      );
    case "radio":
      return (
        <form.Field key={field.name} name={field.name as Path<TFieldValues>}>
          {(f) => (
            <RadioField
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
  sections,
  submitText,
}: FormBuilderProps<TFieldValues>) {
  const { t } = useTranslations();
  const resolvedSections = resolveFormBuilderSections({ fields, sections });

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
      <div className="space-y-5">
        {resolvedSections.map((section) => {
          const title = section.titleKey ? t(section.titleKey) : section.title;
          const description = section.descriptionKey
            ? t(section.descriptionKey)
            : section.description;
          const hasHeader = Boolean(title || description);
          const sectionClassName =
            section.isDefault || section.isUngrouped
              ? "space-y-4"
              : "space-y-4 rounded-md border p-4";

          return (
            <section className={sectionClassName} key={section.id}>
              {hasHeader && (
                <div className="space-y-1">
                  {title && <h3 className="font-medium text-sm">{title}</h3>}
                  {description && (
                    <p className="text-muted-foreground text-sm">
                      {description}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={String(field.name)}>
                    <FormBuilderField field={field} form={form} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
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
