import type { InlineEditCommitResult } from "../../hooks/use-inline-edit-runtime";
import { fieldIsDisabled, fieldIsHidden, validateForm } from "./form-runtime";
import type {
  AnyFieldDefinition,
  FormConfig,
  FormConfigContext,
} from "./types";

/** Advanced pickers and collections use the full catalogue editor. */
export function canEditInlineFormField(
  config: FormConfig | undefined,
  field: AnyFieldDefinition | undefined,
  context: FormConfigContext
): boolean {
  if (!config) {
    return true;
  }
  return Boolean(
    field &&
      !fieldIsHidden(field, context) &&
      !fieldIsDisabled(field, context) &&
      !["collection", "custom"].includes(field.type) &&
      !field.searchOptions &&
      typeof field.options !== "function"
  );
}

/** Apply field and root schemas once, including asynchronous refinements and transforms. */
export async function validateInlineFormValue(
  config: FormConfig | undefined,
  name: string,
  value: unknown,
  context: FormConfigContext
): Promise<InlineEditCommitResult> {
  const field = config?.fields.find((candidate) => candidate.name === name);
  if (!canEditInlineFormField(config, field, context)) {
    return {
      success: false,
      errorMessage: "This field cannot be edited inline.",
    };
  }
  if (!config) {
    return { success: true, committedValue: value };
  }
  const values = { ...context.values, [name]: value };
  const result = await validateForm(
    { ...config, fields: field ? [field] : [] },
    values,
    { ...context, values }
  );
  const errors = Object.values(result.errors);
  return errors.length
    ? { success: false, errorMessage: errors.join("; ") }
    : { success: true, committedValue: result.values[name] };
}
