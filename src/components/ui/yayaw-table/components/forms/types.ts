/**
 * Form field types and interfaces
 * This file defines the types used for the form builder system
 */
import type { ReactNode } from "react";
import type { z } from "zod";

/** Form values type (generic record) */
export type FieldValues = Record<string, unknown>;

/** Field path (dot-notation string for nested fields) */
export type Path<T extends FieldValues> = keyof T extends string
  ? keyof T
  : string;

/**
 * Minimal field API shape passed from TanStack Form's form.Field children.
 * Used by field components to avoid depending on @tanstack/react-form in types.
 */
export interface FormFieldApi<TValue = unknown> {
  handleBlur: () => void;
  handleChange: (value: TValue) => void;
  name: string;
  state: {
    meta: { errors: string[]; isValid: boolean };
    value: TValue;
  };
}

/**
 * Union type of all possible field definitions
 */
export type AnyFieldDefinition<TFieldValues extends FieldValues = FieldValues> =
  | CheckboxFieldDefinition<TFieldValues>
  | CustomFieldDefinition<TFieldValues>
  | DateFieldDefinition<TFieldValues>
  | DynamicValueFieldDefinition<TFieldValues>
  | NumberFieldDefinition<TFieldValues>
  | SelectFieldDefinition<TFieldValues>
  | SelectWithAddNewFieldDefinition<TFieldValues>
  | SwitchFieldDefinition<TFieldValues>
  | TextareaFieldDefinition<TFieldValues>
  | TextFieldDefinition<TFieldValues>
  | ValueTypeFieldDefinition<TFieldValues>;

/**
 * Base field definition that all fields extend
 */
export interface BaseFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> {
  description?: string;
  descriptionKey?: string;
  disabled?: boolean;
  label: string;
  labelKey?: string;
  name: Path<TFieldValues>;
  placeholder?: string;
  placeholderKey?: string;
  required?: boolean;
  translationConfig?: {
    namespace: string;
  };
}

/**
 * Props that custom/render field components receive (TanStack Form field API)
 */
export interface BaseFieldProps<
  _TFieldValues extends FieldValues = FieldValues,
> {
  field: FormFieldApi<unknown>;
  form: {
    getFieldValue: (name: string) => unknown;
    setFieldValue: (name: string, value: unknown) => void;
  };
}

/**
 * Checkbox field
 */
export interface CheckboxFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  type: "checkbox";
  variant?: "checkbox" | "switch";
}

/**
 * Custom field for special cases
 */
export interface CustomFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  renderField: (props: BaseFieldProps<TFieldValues>) => ReactNode;
  type: "custom";
}

/**
 * Date field using shadcn DatePicker
 */
export interface DateFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  format?: string; // Format de date (ex: "yyyy-MM-dd")
  maxDate?: Date;
  minDate?: Date;
  type: "date";
}

/**
 * Dynamic value field that changes based on another field
 */
export interface DynamicValueFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  dependsOn: {
    field: Path<TFieldValues>;
    transform: (value: unknown) => unknown;
  };
  type: "dynamic-value";
}

export type FieldDefinition =
  | CheckboxFieldDefinition
  | DateFieldDefinition
  | DynamicValueFieldDefinition
  | NumberFieldDefinition
  | SelectFieldDefinition
  | SelectWithAddNewFieldDefinition
  | TextFieldDefinition
  | ValueTypeFieldDefinition;

/**
 * All possible field types
 */
export type FieldType = AnyFieldDefinition["type"];

/**
 * Form configuration
 */
export interface FormConfig<TFieldValues extends FieldValues = FieldValues> {
  defaultValues: Partial<TFieldValues>;
  fields: AnyFieldDefinition<TFieldValues>[];
  id: string;
  schema: z.ZodType<TFieldValues>;
  translations: {
    keys: {
      [key: string]: string;
    };
    namespace: string;
  };
}

/**
 * Number field with min/max constraints
 */
export interface NumberFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  max?: number;
  min?: number;
  step?: number;
  type: "number";
}

/**
 * Basic select field
 */
export interface SelectFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  optionKeys?: string[];
  options: Array<{ label: string; value: number | string }>;
  type: "select";
}

/**
 * Select field with ability to add new options
 */
export interface SelectWithAddNewFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  onAddNew: () => void;
  optionKeys?: string[];
  options?: Array<{ label: string; value: number | string }>;
  optionsLoader?: () => Promise<string[]>;
  type: "select-with-add-new";
}

/**
 * Switch field (special case of checkbox)
 */
export interface SwitchFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  type: "switch";
}

/**
 * Textarea field for multiline input
 */
export interface TextareaFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  rows?: number;
  type: "textarea";
}

/**
 * Text field for single line input
 */
export interface TextFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  inputType?: "email" | "password" | "tel" | "text" | "url";
  type: "text";
}

/**
 * Value type field that renders different inputs based on value type
 */
export interface ValueTypeFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  supportedTypes?: Array<"boolean" | "json" | "number" | "string">;
  type: "value-type";
  valueTypeField: Path<TFieldValues>;
}
