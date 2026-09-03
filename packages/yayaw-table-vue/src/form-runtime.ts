import { toRaw } from "vue";
import type {
  FormConfig,
  FormFieldContext,
  FormFieldDefinition,
  FormSectionDefinition,
  TableRecord,
} from "./types";

/** Clone editable data without sharing nested values with a row or configuration. */
export const cloneFormValue = <T>(value: T): T => {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map(cloneFormValue) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneFormValue(item)])
    ) as T;
  }
  return value;
};

export const formValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  }
  if (
    !(left && right) ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const a = Object.entries(left);
  const b = Object.entries(right);
  return (
    a.length === b.length &&
    a.every(
      ([key, value]) =>
        Object.hasOwn(right, key) &&
        formValuesEqual(value, (right as TableRecord)[key])
    )
  );
};

export const fieldIsHidden = (
  field: FormFieldDefinition,
  context: FormFieldContext
): boolean =>
  Boolean(
    typeof field.hidden === "function" ? field.hidden(context) : field.hidden
  );

export const fieldIsDisabled = (
  field: FormFieldDefinition,
  context: FormFieldContext
): boolean =>
  Boolean(
    typeof field.disabled === "function"
      ? field.disabled(context)
      : field.disabled
  );

export const defaultFieldValue = (field: FormFieldDefinition): unknown => {
  if (field.defaultValue !== undefined) {
    return cloneFormValue(field.defaultValue);
  }
  if (field.type === "collection" || field.type === "multiSelect") {
    return [];
  }
  if (field.type === "switch" || field.type === "checkbox") {
    return false;
  }
  return "";
};

export const initialFormValues = (
  config: FormConfig,
  row?: TableRecord
): TableRecord =>
  cloneFormValue({
    ...Object.fromEntries(
      config.fields.map((field) => [field.name, defaultFieldValue(field)])
    ),
    ...config.defaultValues,
    ...row,
  });

export const resolveFormSections = (
  config: FormConfig
): FormSectionDefinition[] => {
  const remaining = new Set(config.fields.map((field) => field.name));
  const sections: FormSectionDefinition[] = [];
  for (const section of config.sections ?? []) {
    const fields = section.fields.filter((name) => remaining.delete(name));
    if (fields.length) {
      sections.push({ ...section, fields });
    }
  }
  if (remaining.size) {
    let id = "__ungrouped";
    while (sections.some((section) => section.id === id)) {
      id += "_";
    }
    sections.push({ id, fields: [...remaining] });
  }
  return sections;
};

export const translateFormConfig = (config: FormConfig): FormConfig => {
  const keys = config.translations?.keys ?? {};
  const translate = (key: string | undefined, fallback: string | undefined) =>
    key ? (keys[key] ?? fallback) : fallback;
  const field = (value: FormFieldDefinition): FormFieldDefinition => ({
    ...value,
    label: translate(value.labelKey, value.label) ?? value.name,
    description: translate(value.descriptionKey, value.description),
    placeholder: translate(value.placeholderKey, value.placeholder),
    itemFields: value.itemFields?.map(field),
    options: Array.isArray(value.options)
      ? value.options.map((option, index) => ({
          ...option,
          label:
            translate(value.optionKeys?.[index], option.label) ?? option.label,
        }))
      : value.options,
  });
  return {
    ...config,
    fields: config.fields.map(field),
    sections: config.sections?.map((section) => ({
      ...section,
      title: translate(section.titleKey, section.title),
      description: translate(section.descriptionKey, section.description),
    })),
  };
};

export interface FormValidationResult {
  values: TableRecord;
  errors: Record<string, string>;
}

const missing = (value: unknown): boolean =>
  value === "" ||
  value === null ||
  value === undefined ||
  (Array.isArray(value) && value.length === 0);

export const dynamicFieldType = (
  field: FormFieldDefinition,
  context: FormFieldContext
): "boolean" | "json" | "number" | "string" => {
  if (!["dynamic-value", "dynamicValue", "value-type"].includes(field.type)) {
    return "string";
  }
  const raw =
    field.type === "value-type"
      ? context.values[field.valueTypeField ?? ""]
      : field.dependsOn?.transform(context.values[field.dependsOn.field]);
  const candidate = String(raw ?? "string") as
    | "boolean"
    | "json"
    | "number"
    | "string";
  return (
    field.supportedTypes ?? ["boolean", "json", "number", "string"]
  ).includes(candidate)
    ? candidate
    : "string";
};

const validateScalar = (
  field: FormFieldDefinition,
  value: unknown,
  context: FormFieldContext
): string | undefined => {
  if (field.required && missing(value)) {
    return `${field.label} is required`;
  }
  const numeric =
    field.type === "number" || dynamicFieldType(field, context) === "number";
  if (
    numeric &&
    !missing(value) &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    return `Invalid ${field.label}`;
  }
  if (numeric && typeof value === "number") {
    if (field.min !== undefined && value < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }
    if (field.max !== undefined && value > field.max) {
      return `${field.label} must be at most ${field.max}`;
    }
  }
  return undefined;
};

const validateCollection = async (
  field: FormFieldDefinition,
  value: unknown[],
  context: FormFieldContext
): Promise<FormValidationResult> => {
  const items: TableRecord[] = [];
  const errors: Record<string, string> = {};
  for (const [index, item] of value.entries()) {
    const path = `${field.name}.${index}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors[path] = "Invalid item";
      continue;
    }
    const child = await validateFormFields(
      field.itemFields ?? [],
      item as TableRecord,
      { ...context, values: item as TableRecord }
    );
    items.push(child.values);
    for (const [name, message] of Object.entries(child.errors)) {
      errors[`${path}.${name}`] = message;
    }
    const issues = field.validateItem?.(child.values, index) ?? [];
    if (issues.length) {
      errors[path] = issues.join("; ");
    }
  }
  const issues = field.validateItems?.(items) ?? [];
  if (issues.length) {
    errors[field.name] = issues.join("; ");
  }
  return { values: { [field.name]: items }, errors };
};

const validateField = async (
  field: FormFieldDefinition,
  value: unknown,
  context: FormFieldContext
): Promise<FormValidationResult> => {
  const values = { [field.name]: value };
  const errors: Record<string, string> = {};
  const scalarError = validateScalar(field, value, context);
  if (scalarError) {
    return { values, errors: { [field.name]: scalarError } };
  }
  if (field.type === "collection" && Array.isArray(value)) {
    const result = await validateCollection(field, value, context);
    Object.assign(values, result.values);
    Object.assign(errors, result.errors);
  }
  if (field.schema) {
    // Zod schemas contain non-configurable properties and must not run through Vue proxies.
    const result = await toRaw(field.schema).safeParseAsync(values[field.name]);
    if (result.success) {
      values[field.name] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors[[field.name, ...issue.path].join(".")] = issue.message;
      }
    }
  }
  return { values, errors };
};

export const validateFormFields = async (
  fields: FormFieldDefinition[],
  values: TableRecord,
  context: FormFieldContext
): Promise<FormValidationResult> => {
  const output = cloneFormValue(values);
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (fieldIsHidden(field, context) || fieldIsDisabled(field, context)) {
      continue;
    }
    const result = await validateField(field, output[field.name], context);
    Object.assign(output, result.values);
    Object.assign(errors, result.errors);
  }
  return { values: output, errors };
};

export const validateForm = async (
  config: FormConfig,
  values: TableRecord,
  context: FormFieldContext
): Promise<FormValidationResult> => {
  const result = await validateFormFields(config.fields, values, context);
  if (!Object.keys(result.errors).length && config.schema) {
    const parsed = await toRaw(config.schema).safeParseAsync(result.values);
    if (parsed.success) {
      if (
        parsed.data &&
        typeof parsed.data === "object" &&
        !Array.isArray(parsed.data)
      ) {
        result.values = parsed.data as TableRecord;
      } else {
        result.errors.form = "The form schema must return an object";
      }
    } else {
      for (const issue of parsed.error.issues) {
        result.errors[issue.path.join(".") || "form"] = issue.message;
      }
    }
  }
  return result;
};

export const formSubmissionValues = (
  config: FormConfig,
  values: TableRecord,
  initial: TableRecord,
  context: FormFieldContext
): TableRecord => {
  const output =
    config.submitMode === "patch" && context.mode === "edit"
      ? Object.fromEntries(
          config.fields
            .filter(
              (field) =>
                !formValuesEqual(values[field.name], initial[field.name])
            )
            .map((field) => [field.name, values[field.name]])
        )
      : cloneFormValue(values);
  for (const field of config.fields) {
    if (fieldIsHidden(field, context) || fieldIsDisabled(field, context)) {
      delete output[field.name];
    }
  }
  return output;
};
