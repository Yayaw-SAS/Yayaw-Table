import type {
  FormConfig,
  FormFieldDefinition,
  TableBehaviorConfig,
  TableConfig,
  TableDisplayMode,
  TableLayoutPreset,
  TableRecord,
} from "./types";

export const defaultTableBehavior: TableBehaviorConfig = {
  allowCreate: true,
  allowEdit: true,
  allowDuplicate: true,
  allowDelete: true,
  allowBulkEdit: true,
  allowBulkDelete: true,
  allowInlineEdit: false,
  allowViewSave: true,
  allowViewSharing: false,
  showToolbar: true,
  showToolbarHeader: true,
  showResetFilters: false,
  export: true,
  bulkExport: true,
  actionsAsIcons: false,
  density: "medium",
  layoutPreset: "default",
  displayModes: ["table"],
  defaultDisplayMode: "table",
  emptyState: { show: true },
  defaultPageSize: 10,
  enableColumnDragDropByDefault: true,
  enableColumnFilters: true,
  enableColumnPinning: true,
  enableMultiRowSelection: true,
  enablePagination: true,
  enableRowSelection: true,
  enableSorting: true,
  enableViews: true,
  pageSizeOptions: [10, 20, 50, 100],
  inlineEdit: {
    enabled: false,
    debounceMs: 500,
    optimistic: true,
    showDelayIndicator: true,
    trigger: "doubleClickEnter",
  },
  enableCalculations: false,
  enableGrouping: true,
  dateDisplayPreset: "localized-short",
};

const layoutDefaults: Record<
  TableLayoutPreset,
  Partial<TableBehaviorConfig>
> = {
  default: {},
  admin: {
    actionsAsIcons: true,
    defaultPageSize: 20,
    density: "small",
    pageSizeOptions: [10, 20, 50, 100],
  },
  catalog: {
    actionsAsIcons: true,
    defaultPageSize: 20,
    density: "medium",
    pageSizeOptions: [10, 20, 50],
  },
  preview: {
    actionsAsIcons: true,
    defaultPageSize: 20,
    density: "small",
    pageSizeOptions: [10, 20, 50],
    showToolbarHeader: false,
  },
};

export const resolveTableDisplayModes = (
  displayModes?: TableDisplayMode[]
): TableDisplayMode[] => {
  const allowed: TableDisplayMode[] = ["table", "kanban", "gallery"];
  const unique = (displayModes ?? ["table"]).filter(
    (mode, index, modes) =>
      allowed.includes(mode) && modes.indexOf(mode) === index
  );
  return unique.length > 0 ? unique : ["table"];
};

export const defineTableConfig = <TData extends TableRecord>(
  input: Omit<TableConfig<TData>, "table"> & {
    table?: Partial<TableBehaviorConfig<TData>>;
  }
): TableConfig<TData> => {
  const preset = input.table?.layoutPreset ?? "default";
  const displayModes = resolveTableDisplayModes(input.table?.displayModes);
  const requestedMode = input.table?.defaultDisplayMode;
  const defaultDisplayMode =
    requestedMode && displayModes.includes(requestedMode)
      ? requestedMode
      : (displayModes[0] ?? "table");
  return {
    ...input,
    columns: {
      ...input.columns,
      definitions: input.columns.definitions.map((column) => ({
        ...column,
        dateDisplayPreset:
          column.type === "date"
            ? (column.dateDisplayPreset ??
              input.table?.dateDisplayPreset ??
              defaultTableBehavior.dateDisplayPreset)
            : column.dateDisplayPreset,
      })),
      sort: input.columns.sort ?? [],
      mandatory: input.columns.mandatory ?? [],
      order:
        input.columns.order.length > 0
          ? input.columns.order
          : input.columns.definitions.map((column) => column.id),
      visible:
        input.columns.visible.length > 0
          ? input.columns.visible
          : input.columns.definitions.map((column) => column.id),
    },
    table: {
      ...defaultTableBehavior,
      ...layoutDefaults[preset],
      ...input.table,
      layoutPreset: preset,
      displayModes,
      defaultDisplayMode,
      emptyState: {
        ...defaultTableBehavior.emptyState,
        ...input.table?.emptyState,
      },
      inlineEdit: {
        ...defaultTableBehavior.inlineEdit,
        ...input.table?.inlineEdit,
      },
    } as TableBehaviorConfig<TData>,
  };
};

export const defineFormConfig = <TData extends TableRecord>(
  config: FormConfig<TData>
): FormConfig<TData> => config;

type FieldOptions = Omit<FormFieldDefinition, "type">;
const fromOptions = (
  type: FormFieldDefinition["type"],
  input: FieldOptions | string,
  label?: string,
  overrides: Partial<FormFieldDefinition> = {}
): FormFieldDefinition =>
  typeof input === "string"
    ? { name: input, label: label ?? input, type, ...overrides }
    : { ...input, type };

export function createTextField(options: FieldOptions): FormFieldDefinition;
export function createTextField(
  name: string,
  label: string,
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition;
export function createTextField(
  input: FieldOptions | string,
  label?: string,
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition {
  return fromOptions("text", input, label, overrides);
}

export function createDateField(options: FieldOptions): FormFieldDefinition;
export function createDateField(
  name: string,
  label: string,
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition;
export function createDateField(
  input: FieldOptions | string,
  label?: string,
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition {
  return fromOptions("date", input, label, overrides);
}

export function createRadioField(options: FieldOptions): FormFieldDefinition;
export function createRadioField(
  name: string,
  label: string,
  options: FormFieldDefinition["options"],
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition;
export function createRadioField(
  input: FieldOptions | string,
  label?: string,
  options?: FormFieldDefinition["options"],
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition {
  return typeof input === "string"
    ? fromOptions("radio", input, label, { options, ...overrides })
    : fromOptions("radio", input);
}

export function createCollectionField(
  options: FieldOptions
): FormFieldDefinition;
export function createCollectionField(
  name: string,
  label: string,
  itemFields: FormFieldDefinition[],
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition;
export function createCollectionField(
  input: FieldOptions | string,
  label?: string,
  itemFields?: FormFieldDefinition[],
  overrides?: Partial<FormFieldDefinition>
): FormFieldDefinition {
  return typeof input === "string"
    ? fromOptions("collection", input, label, { itemFields, ...overrides })
    : fromOptions("collection", input);
}

export const createCheckboxField = (
  options: FieldOptions
): FormFieldDefinition => fromOptions("checkbox", options);
export const createCustomField = (options: FieldOptions): FormFieldDefinition =>
  fromOptions("custom", options);
export const createDynamicValueField = (
  options: FieldOptions
): FormFieldDefinition => fromOptions("dynamic-value", options);
export const createMultiSelectField = (
  options: FieldOptions
): FormFieldDefinition => fromOptions("multiSelect", options);
export const createNumberField = (options: FieldOptions): FormFieldDefinition =>
  fromOptions("number", options);
export const createSelectField = (options: FieldOptions): FormFieldDefinition =>
  fromOptions("select", options);
export const createSelectWithAddNewField = (
  options: FieldOptions
): FormFieldDefinition =>
  fromOptions("select-with-add-new", {
    options: options.options ?? [],
    ...options,
  });
export const createSwitchField = (options: FieldOptions): FormFieldDefinition =>
  fromOptions("switch", options);
export const createTextareaField = (
  options: FieldOptions
): FormFieldDefinition => fromOptions("textarea", options);
export const createUrlField = (options: FieldOptions): FormFieldDefinition =>
  fromOptions("url", options);
export const createValueTypeField = (
  options: FieldOptions
): FormFieldDefinition => fromOptions("value-type", options);
export const createNamedField = (
  name: string,
  definition: Omit<FormFieldDefinition, "name">
): FormFieldDefinition => ({ ...definition, name });
