import type {
  AnyFieldDefinition,
  CheckboxFieldDefinition,
  CollectionFieldDefinition,
  CustomFieldDefinition,
  DateFieldDefinition,
  DynamicValueFieldDefinition,
  FieldValues,
  MultiSelectFieldDefinition,
  NumberFieldDefinition,
  Path,
  RadioFieldDefinition,
  SelectFieldDefinition,
  SelectWithAddNewFieldDefinition,
  SwitchFieldDefinition,
  TextareaFieldDefinition,
  TextFieldDefinition,
  UrlFieldDefinition,
  ValueTypeFieldDefinition,
} from "./types";

interface BaseFieldOptions<TFieldValues extends FieldValues> {
  dependsOn?: {
    field: Path<TFieldValues>;
    transform: (value: unknown) => string;
  };
  description?: string;
  descriptionKey?: string;
  disabled?: boolean;
  label: string;
  labelKey?: string;
  name: Path<TFieldValues>;
  placeholder?: string;
  placeholderKey?: string;
  required?: boolean;
}

/**
 * Create a checkbox field definition
 */
export function createCheckboxField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<CheckboxFieldDefinition<TFieldValues>, "type">
): CheckboxFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "checkbox",
  };
}

/**
 * Create a collection field definition
 */
export function createCollectionField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<CollectionFieldDefinition<TFieldValues>, "type">
): CollectionFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "collection",
  };
}

/**
 * Create a custom field definition
 */
export function createCustomField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<CustomFieldDefinition<TFieldValues>, "type">
): CustomFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "custom",
  };
}

/**
 * Create a date field definition
 */
export function createDateField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<DateFieldDefinition<TFieldValues>, "type">
): DateFieldDefinition<TFieldValues>;
export function createDateField(
  name: string,
  label: string,
  options?: Partial<DateFieldDefinition>
): DateFieldDefinition;
export function createDateField<
  TFieldValues extends FieldValues = FieldValues,
>(
  input: Omit<DateFieldDefinition<TFieldValues>, "type"> | string,
  label?: string,
  options: Partial<DateFieldDefinition> = {}
): DateFieldDefinition<TFieldValues> {
  if (typeof input === "string") {
    return {
      ...(options as Partial<DateFieldDefinition<TFieldValues>>),
      label: label ?? input,
      name: input as Path<TFieldValues>,
      type: "date",
    };
  }

  return {
    ...input,
    type: "date",
  };
}

/**
 * Create a dynamic value field definition
 */
export function createDynamicValueField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<DynamicValueFieldDefinition<TFieldValues>, "type">
): DynamicValueFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "dynamic-value",
  };
}

/**
 * Create a multi-select field definition
 */
export function createMultiSelectField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<MultiSelectFieldDefinition<TFieldValues>, "type">
): MultiSelectFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "multiSelect",
  };
}

/**
 * Helper to create a field definition with a name
 * This is useful for creating fields with a specific name
 */
export function createNamedField<
  TFieldValues extends FieldValues = FieldValues,
>(
  name: Path<TFieldValues>,
  fieldDefinition: Omit<AnyFieldDefinition<TFieldValues>, "name">
): AnyFieldDefinition<TFieldValues> {
  if (!fieldDefinition.type) {
    throw new Error("Field definition must have a type property");
  }

  return {
    ...fieldDefinition,
    name,
  } as AnyFieldDefinition<TFieldValues>;
}

/**
 * Create a number field definition
 */
export function createNumberField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: BaseFieldOptions<TFieldValues> & {
    max?: number;
    min?: number;
  }
): NumberFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "number",
  };
}

/**
 * Create a radio group field definition
 */
export function createRadioField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<RadioFieldDefinition<TFieldValues>, "type">
): RadioFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "radio",
  };
}

/**
 * Create a select field definition
 */
export function createSelectField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<SelectFieldDefinition<TFieldValues>, "type">
): SelectFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "select",
  };
}

/**
 * Create a select with add new field definition
 */
export function createSelectWithAddNewField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<SelectWithAddNewFieldDefinition<TFieldValues>, "type">
): SelectWithAddNewFieldDefinition<TFieldValues> {
  return {
    ...options,
    options: options.options || [],
    type: "select-with-add-new",
  };
}

/**
 * Create a switch field definition
 */
export function createSwitchField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<SwitchFieldDefinition<TFieldValues>, "type">
): SwitchFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "switch",
  };
}

/**
 * Create a textarea field definition
 */
export function createTextareaField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<TextareaFieldDefinition<TFieldValues>, "type">
): TextareaFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "textarea",
  };
}

/**
 * Create a text field definition
 */
export function createTextField<TFieldValues extends FieldValues = FieldValues>(
  options: Omit<TextFieldDefinition<TFieldValues>, "type">
): TextFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "text",
  };
}

/**
 * Create a URL field definition with optional meta preview
 */
export function createUrlField<TFieldValues extends FieldValues = FieldValues>(
  options: Omit<UrlFieldDefinition<TFieldValues>, "type">
): UrlFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "url",
  };
}

/**
 * Create a value type field definition
 */
export function createValueTypeField<
  TFieldValues extends FieldValues = FieldValues,
>(
  options: Omit<ValueTypeFieldDefinition<TFieldValues>, "type">
): ValueTypeFieldDefinition<TFieldValues> {
  return {
    ...options,
    type: "value-type",
  };
}
