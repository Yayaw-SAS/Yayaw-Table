import { bulkClearCandidate } from "./bulk-editor";
import {
  cloneFormValue,
  fieldIsDisabled,
  fieldIsHidden,
  formValuesEqual,
  validateForm,
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
    .sort(
      (left, right) =>
        (context.bulkEdit?.fields.indexOf(left.name) ?? 0) -
        (context.bulkEdit?.fields.indexOf(right.name) ?? 0)
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

/** Validate drafts without publishing them; reject unsupported clears through the field schema. */
export async function validateBulkDraft(
  config: FormConfig,
  context: FormFieldContext
) {
  const values = context.values ?? {};
  const [draft, candidates] = await Promise.all([
    validateForm(config, bulkFormValues(config, values), context),
    Promise.all(
      config.fields.map(async (field) => {
        const candidate = bulkClearCandidate(field);
        if (!candidate) {
          return;
        }
        const result = await validateForm(
          { ...config, schema: undefined, fields: [field] },
          { [field.name]: candidate.value },
          { ...context, values: { ...values, [field.name]: candidate.value } }
        );
        return Object.keys(result.errors).length
          ? undefined
          : ([field.name, candidate.value] as const);
      })
    ),
  ]);
  const clearValues: TableRecord = {};
  for (const candidate of candidates) {
    if (candidate) {
      clearValues[candidate[0]] = candidate[1];
    }
  }
  return {
    valid: config.fields.length > 0 && !Object.keys(draft.errors).length,
    clearValues,
  };
}
