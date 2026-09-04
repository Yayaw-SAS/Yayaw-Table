import {
  cloneFormValue,
  fieldIsDisabled,
  fieldIsHidden,
  formValuesEqual,
} from "./form-runtime";
import type {
  FormConfig,
  FormFieldContext,
  FormFieldDefinition,
  TableRecord,
} from "./types";

const reservedFields = new Set([
  "id",
  "_id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
]);

/** Start with common values, never the first row's differing values. */
export const commonBulkValues = (rows: readonly TableRecord[]): TableRecord =>
  cloneFormValue(
    Object.fromEntries(
      Object.entries(rows[0] ?? {}).filter(([key, value]) =>
        rows.every((row) => formValuesEqual(row[key], value))
      )
    )
  );

/** Check conditional fields against every target, including explicitly changed dependencies. */
export const bulkFieldEditable = (
  field: FormFieldDefinition,
  context: FormFieldContext
): boolean => {
  if (reservedFields.has(field.name) || field.bulkEdit === false) {
    return false;
  }
  const patch = Object.fromEntries(
    (context.bulkEdit?.fields ?? []).map((name) => [name, context.values[name]])
  );
  return (context.bulkEdit?.rows ?? []).every((row) => {
    const rowContext = { ...context, row, values: { ...row, ...patch } };
    return !(
      fieldIsHidden(field, rowContext) || fieldIsDisabled(field, rowContext)
    );
  });
};

/** Keep field validation, but not a full-row schema that requires untouched fields. */
export const bulkFormConfig = (
  config: FormConfig,
  context: FormFieldContext
): FormConfig => ({
  ...config,
  schema: undefined,
  submitMode: "full",
  fields: config.fields
    .filter(
      (field) =>
        context.bulkEdit?.fields.includes(field.name) &&
        bulkFieldEditable(field, context)
    )
    .map((field) => ({ ...field, hidden: false, disabled: false })),
});

/** Strip untouched fields before validation and transforms, including undeclared row metadata. */
export const bulkFormValues = (
  config: FormConfig,
  values: TableRecord
): TableRecord =>
  cloneFormValue(
    Object.fromEntries(
      config.fields.map((field) => [field.name, values[field.name]])
    )
  );

/** Invalid completion reports must never clear unrelated rows or cause a silent success. */
export const bulkCompletion = (
  ids: string[],
  result: { success: boolean; failedIds?: string[] }
): { completed: string[]; remaining: string[] } => {
  if (result.success) {
    return { completed: [...ids], remaining: [] };
  }
  const failed = result.failedIds;
  if (!failed?.length || failed.some((id) => !ids.includes(id))) {
    return { completed: [], remaining: [...ids] };
  }
  return {
    completed: ids.filter((id) => !failed.includes(id)),
    remaining: ids.filter((id) => failed.includes(id)),
  };
};
