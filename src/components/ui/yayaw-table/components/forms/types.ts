/**
 * Form field types and interfaces
 * This file defines the types used for the form builder system
 */
import type { ReactNode } from "react";
import type { z } from "zod";
import type { TableConfig } from "../../config/helpers";
import type { TableActions } from "../../providers/table-provider";
import type { DataTableTranslations } from "../../types/translations";
import type { TableView } from "../../types/view-types";

/** Form values type (generic record) */
export type FieldValues = Record<string, unknown>;

/** Field path (dot-notation string for nested fields) */
export type Path<T extends FieldValues> = keyof T extends string
  ? keyof T
  : string;

export type FormConfigMode = "create" | "edit";

export interface FormConfigContext<
  TFieldValues extends FieldValues = FieldValues,
  TRowData extends Record<string, unknown> = Record<string, unknown>,
> {
  bulkEdit?: {
    ids: readonly string[];
    rows: readonly Record<string, unknown>[];
    fields: readonly string[];
  };
  setFieldValue?: (name: string, value: unknown) => void;
  touchField?: (name: string) => void;
  formType: string;
  initialData?: Partial<TFieldValues>;
  mode: FormConfigMode;
  row?: TRowData;
  tableId: string;
  tableType: string;
  values?: Partial<TFieldValues>;
  locale?: string;
  translations?: DataTableTranslations;
}

/**
 * Minimal field API shape passed from TanStack Form's form.Field children.
 * Used by field components to avoid depending on @tanstack/react-form in types.
 */
export interface FormFieldApi<TValue = unknown> {
  handleBlur: () => void;
  handleChange(value: TValue): void;
  name: string;
  state: {
    meta: { errors: string[]; isValid: boolean };
    value: TValue;
  };
}

/**
 * Declarative form section that groups existing fields for clearer admin forms.
 */
export interface FormSectionDefinition<
  TFieldValues extends FieldValues = FieldValues,
> {
  description?: string;
  descriptionKey?: string;
  columns?: 1 | 2 | 3;
  fields: Path<TFieldValues>[];
  id: string;
  title?: string;
  titleKey?: string;
}

/**
 * Union type of all possible field definitions
 */
export type AnyFieldDefinition<TFieldValues extends FieldValues = FieldValues> =
  | CheckboxFieldDefinition<TFieldValues>
  | CollectionFieldDefinition<TFieldValues>
  | CustomFieldDefinition<TFieldValues>
  | DateFieldDefinition<TFieldValues>
  | DynamicValueFieldDefinition<TFieldValues>
  | MultiSelectFieldDefinition<TFieldValues>
  | NumberFieldDefinition<TFieldValues>
  | RadioFieldDefinition<TFieldValues>
  | SelectFieldDefinition<TFieldValues>
  | SelectWithAddNewFieldDefinition<TFieldValues>
  | SwitchFieldDefinition<TFieldValues>
  | TablePickerFieldDefinition<TFieldValues>
  | TextareaFieldDefinition<TFieldValues>
  | TextFieldDefinition<TFieldValues>
  | UrlFieldDefinition<TFieldValues>
  | ValueTypeFieldDefinition<TFieldValues>;

export interface FormSelectOption {
  label: string;
  value: boolean | number | string;
  disabled?: boolean;
  color?: string;
}
export type FormOptions =
  | FormSelectOption[]
  | ((
      context: FormConfigContext
    ) => FormSelectOption[] | Promise<FormSelectOption[]>);

/**
 * Base field definition that all fields extend
 */
export interface BaseFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> {
  description?: string;
  descriptionKey?: string;
  disabled?: boolean | ((context: FormConfigContext) => boolean);
  hidden?: boolean | ((context: FormConfigContext) => boolean);
  bulkEdit?: boolean;
  defaultValue?: unknown;
  schema?: z.ZodType;
  options?: FormOptions;
  optionDependencies?: string[];
  optionsScope?: string | number;
  searchOptions?: (
    query: string,
    context: FormConfigContext,
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  resolveOptions?: (
    values: unknown[],
    context: FormConfigContext,
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  createOption?: (
    label: string,
    context: FormConfigContext,
    signal: AbortSignal
  ) => FormSelectOption | Promise<FormSelectOption>;
  searchMinLength?: number;
  searchDebounceMs?: number;
  itemFields?: AnyFieldDefinition[];
  validateItem?: (item: FieldValues, index: number | null) => string[];
  validateItems?: (items: readonly FieldValues[]) => string[];
  min?: number;
  max?: number;
  valueTypeField?: string;
  supportedTypes?: Array<"boolean" | "json" | "number" | "string">;
  dependsOn?: { field: string; transform: (value: unknown) => unknown };
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

export type CollectionFieldItem = Record<string, unknown>;

export interface CollectionFieldColumnDefinition {
  header: string;
  id: string;
  render?: (item: CollectionFieldItem, index: number) => ReactNode;
}

export interface CollectionFieldCreateAction {
  createItem: (items: readonly CollectionFieldItem[]) => CollectionFieldItem;
  id?: string;
  label: string;
}

export interface CollectionFieldActionLabels {
  actions: string;
  addTitle: string;
  cancel: string;
  deleteItem: string;
  editItem: string;
  editTitle: string;
  moveDown: string;
  moveUp: string;
  save: string;
}

/**
 * Collection field for editing array-like values with add/edit/delete/reorder
 * controls. The form value remains the source of truth.
 */
export interface CollectionFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  addLabel?: string;
  columns?: CollectionFieldColumnDefinition[];
  collectionMode?: "inline" | "dialog";
  createActions?: CollectionFieldCreateAction[];
  createItem?: (items: readonly CollectionFieldItem[]) => CollectionFieldItem;
  emptyLabel?: string;
  getItemKey?: (item: CollectionFieldItem, index: number) => string;
  itemLabel?: string;
  labelKeys?: Partial<Record<keyof CollectionFieldActionLabels, string>>;
  labels?: Partial<CollectionFieldActionLabels>;
  renderItemForm?: (props: {
    disabled?: boolean;
    index: number | null;
    item: CollectionFieldItem;
    onChange: (item: CollectionFieldItem) => void;
  }) => ReactNode;
  type: "collection";
  validateItem?: (item: CollectionFieldItem, index: number | null) => string[];
  validateItems?: (items: readonly CollectionFieldItem[]) => string[];
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
 * Date field using a native date input for predictable serialized values.
 */
export interface DateFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  format?: string;
  maxDate?: Date | string;
  minDate?: Date | string;
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
  | CollectionFieldDefinition
  | DateFieldDefinition
  | DynamicValueFieldDefinition
  | MultiSelectFieldDefinition
  | NumberFieldDefinition
  | RadioFieldDefinition
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
  defaultValues?: Partial<TFieldValues>;
  title?: string | ((mode: FormConfigMode, row?: FieldValues) => string);
  description?: string;
  presentation?: "drawer" | "modal";
  width?: string;
  submitLabel?: string;
  cancelLabel?: string;
  submitMode?: "full" | "patch";
  loadInitialValues?: (
    row: FieldValues | undefined,
    context: FormConfigContext,
    signal: AbortSignal
  ) => FieldValues | Promise<FieldValues>;
  transform?: (
    values: FieldValues,
    context: FormConfigContext
  ) => FieldValues | Promise<FieldValues>;
  fields: AnyFieldDefinition<TFieldValues>[];
  id: string;
  schema?: z.ZodType<TFieldValues>;
  sections?: FormSectionDefinition<TFieldValues>[];
  translations?: {
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
 * Radio group field for single-choice enum values.
 */
export interface RadioFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  optionKeys?: string[];
  options?: FormOptions;
  type: "radio";
}

/**
 * Basic select field
 */
export interface SelectFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  optionKeys?: string[];
  options?: FormOptions;
  type: "select";
}

/**
 * Multi-select field for editing array values from a finite option set.
 */
export interface MultiSelectFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  optionKeys?: string[];
  options?: FormOptions;
  type: "multiSelect";
}

/**
 * Select field with ability to add new options
 */
export interface SelectWithAddNewFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  onAddNew?: () => void;
  optionKeys?: string[];
  options?: FormOptions;
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

export interface TablePickerFieldConfig<
  TRow extends Record<string, unknown> = Record<string, unknown>,
  TFieldValues extends FieldValues = FieldValues,
> {
  /** Optional server and saved-view contracts for the nested table. */
  actions?:
    | TableActions
    | ((context: FormConfigContext<TFieldValues>) => TableActions | undefined);
  /** A complete table catalogue, optionally derived from the current form. */
  config:
    | TableConfig
    | ((context: FormConfigContext<TFieldValues>) => TableConfig);
  /** Optional local rows, optionally derived from the current form. */
  data?:
    | TRow[]
    | ((context: FormConfigContext<TFieldValues>) => TRow[]);
  /** Convert a table row to the stable string ID used by table selection. */
  getRowId?: (row: TRow) => string;
  initialActiveViewId?: string;
  initialViews?: TableView[];
  locale?: string;
  /** Limit the scrolling table body height. */
  maxHeight?: string;
  /** Allow several selected values. Defaults to true. */
  multiple?: boolean;
  /** Convert a selected row ID to the value stored in the form. */
  parseValue?: (id: string) => unknown;
  /** Toggle a row when its non-interactive area is clicked. Defaults to true. */
  selectOnRowClick?: boolean;
  /** Keep nested table state in the URL. Defaults to false for form fields. */
  syncUrl?: boolean;
  /** The nested table catalogue identifier. */
  tableType: string;
  translations?: DataTableTranslations;
}

export interface TablePickerFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  tablePicker: TablePickerFieldConfig<Record<string, unknown>, TFieldValues>;
  type: "tablePicker";
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
 * URL field with optional Open Graph meta preview
 */
export interface UrlFieldDefinition<
  TFieldValues extends FieldValues = FieldValues,
> extends BaseFieldDefinition<TFieldValues> {
  showMetaPreview?: boolean;
  type: "url";
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
