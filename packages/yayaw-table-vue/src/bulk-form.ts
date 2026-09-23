import {
  bulkClearCandidate,
  bulkConditionState,
  bulkMixedDependencies,
} from "./bulk-editor";
import {
  cloneFormValue,
  fieldIsDisabled,
  fieldIsHidden,
  formRuleSet,
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

/** A bulk context evaluating the config's declared rules on the shared values (mixed ones never match). */
export const bulkRuleContext = (
  config: FormConfig,
  context: FormFieldContext
): FormFieldContext => ({
  ...context,
  formRules: formRuleSet(config, { legacy: false }),
});

/** The declared rules of a bulk context, with the fields whose values differ across rows. */
export const bulkRuleState = (context: FormFieldContext) =>
  context.formRules && context.bulkEdit
    ? bulkConditionState({
        rules: context.formRules.rules,
        fields: context.formRules.fields,
        rows: context.bulkEdit.rows,
        applied: context.bulkEdit.fields,
        values: context.values ?? {},
      })
    : undefined;

/** Labels of the mixed fields a field's rules read, for the "mixed" note. */
export const bulkMixedFieldsOf = (
  field: FormFieldDefinition,
  context: FormFieldContext
): string[] => {
  const state = bulkRuleState(context);
  return state && context.formRules
    ? bulkMixedDependencies(context.formRules, field.name, state.mixed)
    : [];
};

/** Legacy predicates run per row, with the draft's changed dependencies. */
const editableInEveryRow = (
  field: FormFieldDefinition,
  context: FormFieldContext
): boolean => {
  const patch = Object.fromEntries(
    (context.bulkEdit?.fields ?? []).map((name) => [name, context.values[name]])
  );
  return (context.bulkEdit?.rows ?? []).every((row) => {
    const rowContext = {
      ...context,
      formRules: undefined,
      row,
      values: { ...row, ...patch },
    };
    return !(
      fieldIsHidden(field, rowContext) || fieldIsDisabled(field, rowContext)
    );
  });
};

/**
 * Check conditional fields against every target, including explicitly
 * changed dependencies. Declared rules read the edited values or the value
 * shared by every row; a value that differs is treated as not matching.
 */
export const bulkFieldEditable = (
  field: FormFieldDefinition,
  context: FormFieldContext
): boolean => {
  if (reservedFields.has(field.name) || field.bulkEdit === false) {
    return false;
  }
  if (!editableInEveryRow(field, context)) {
    return false;
  }
  return !bulkRuleState(context)?.evaluation.hidden.has(field.name);
};

/** Fields held back only by a rule reading mixed values, with those values' labels. */
export const bulkBlockedFields = (
  fields: readonly FormFieldDefinition[],
  context: FormFieldContext
): { field: FormFieldDefinition; mixed: string[] }[] =>
  fields.flatMap((field) => {
    if (
      reservedFields.has(field.name) ||
      field.bulkEdit === false ||
      bulkFieldEditable(field, context) ||
      !editableInEveryRow(field, context)
    ) {
      return [];
    }
    const mixed = bulkMixedFieldsOf(field, context);
    return mixed.length ? [{ field, mixed }] : [];
  });

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
