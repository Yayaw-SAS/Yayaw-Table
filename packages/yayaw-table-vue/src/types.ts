import type { QueryClient } from "@tanstack/vue-query";
import type { Component, VNodeChild } from "vue";
import type { ZodType } from "zod";

export type TableRecord = Record<string, unknown>;
export type PrimitiveValue = boolean | number | string;
export type MaybePromise<T> = Promise<T> | T;
export type TableDisplayMode = "gallery" | "kanban" | "table";
export type TableDensity = "large" | "medium" | "small";
export type TableLayoutPreset = "admin" | "catalog" | "default" | "preview";
export type TableRowClickMode =
  | "activate"
  | "default"
  | "edit"
  | "link"
  | "none";
export type TableGalleryAspectRatio = "portrait" | "square" | "video" | "wide";
export type TableGalleryCardSize = "large" | "medium" | "small";
export type TableGalleryImageFit = "contain" | "cover";
export type DateDisplayPreset =
  | "date"
  | "dateTime"
  | "dmy-numeric"
  | "dmy-short"
  | "iso"
  | "iso-date"
  | "localized-long"
  | "localized-medium"
  | "localized-short"
  | "long"
  | "mdy-numeric"
  | "mdy-short"
  | "month-name-long"
  | "month-year"
  | "relative"
  | "short"
  | "time";

export type ColumnType =
  | "actions"
  | "boolean"
  | "code"
  | "custom"
  | "date"
  | "dynamicType"
  | "image"
  | "json"
  | "multiSelect"
  | "number"
  | "select"
  | "string"
  | "tag"
  | "text"
  | "url";

export type InlineEditEditor =
  | "auto"
  | "boolean"
  | "date"
  | "json"
  | "multiSelect"
  | "number"
  | "select"
  | "text"
  | "textarea"
  | "url";

export interface SelectOption {
  label: string;
  value: PrimitiveValue;
  color?: string;
  disabled?: boolean;
}

export interface InlineEditColumnConfig {
  enabled?: boolean;
  editor?: InlineEditEditor;
  debounceMs?: number;
  formField?: string;
  options?: SelectOption[];
  readonly?: boolean;
}

export interface TableInlineEditConfig {
  enabled?: boolean;
  debounceMs?: number;
  trigger?: "doubleClickEnter";
  optimistic?: boolean;
  showDelayIndicator?: boolean;
}

export type CalculationType =
  | "average"
  | "count_all"
  | "count_empty"
  | "count_false"
  | "count_not_empty"
  | "count_true"
  | "count_unique"
  | "count_values"
  | "max"
  | "median"
  | "min"
  | "none"
  | "percent_empty"
  | "percent_false"
  | "percent_not_empty"
  | "percent_true"
  | "range"
  | "sum";

export interface ColumnNumberFormat {
  currency?: string;
  decimalPlaces?: number;
  decimalSeparator?: "," | ".";
  locale?: string;
  prefix?: string;
  suffix?: string;
  thousandsSeparator?: "," | "." | " " | "none";
}

export interface ColumnDefinition<TData extends TableRecord = TableRecord> {
  [key: string]: unknown;
  id: string;
  header: string;
  type?: ColumnType;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => unknown;
  cellRenderer?: (value: unknown, row: TData) => VNodeChild;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableGrouping?: boolean;
  enableHiding?: boolean;
  /** Allow the native column menu to change this column's pinned position. */
  enablePinning?: boolean;
  enableCalculation?: boolean;
  displayVariant?: "default" | "tag";
  dateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  defaultCalculation?: CalculationType;
  inlineEdit?: boolean | InlineEditColumnConfig;
  tagColorMap?: Record<string, string>;
  options?: SelectOption[];
  numberFormat?: ColumnNumberFormat;
  size?: number;
  minSize?: number;
  maxSize?: number;
  typeKey?: string;
  customRenderers?: Record<string, (value: unknown, row: TData) => VNodeChild>;
  showQuotes?: boolean;
  urlDisplayMode?: "domain" | "full" | "icon" | "row-link";
}

export interface TableColumnsConfig<TData extends TableRecord = TableRecord> {
  definitions: ColumnDefinition<TData>[];
  mandatory: string[];
  order: string[];
  sort?: SortingState;
  visible: string[];
}

export interface TableEmptyStateConfig {
  description?: string;
  show?: boolean;
  title?: string;
}

export interface TableKanbanGroupConfig {
  value: string;
  label?: string;
}

export interface TableKanbanConfig {
  groupBy?: string;
  titleColumn?: string;
  cardColumnIds?: string[];
  showCardLabels?: boolean;
  groups?: TableKanbanGroupConfig[];
  allowDragUpdate?: boolean;
}

export interface TableKanbanViewConfig {
  groupBy?: string;
  titleColumn?: string;
  cardColumnIds?: string[];
  showCardLabels?: boolean;
}

export interface TableGalleryConfig {
  imageColumn?: string;
  titleColumn?: string;
  cardColumnIds?: string[];
  aspectRatio?: TableGalleryAspectRatio;
  imageFit?: TableGalleryImageFit;
  cardSize?: TableGalleryCardSize;
  showCardLabels?: boolean;
}

export type TableGalleryViewConfig = TableGalleryConfig;

export interface TableBehaviorConfig<TData extends TableRecord = TableRecord> {
  allowCreate: boolean;
  allowEdit: boolean;
  allowDuplicate: boolean;
  allowDelete: boolean;
  allowBulkEdit: boolean;
  allowBulkDelete: boolean;
  allowInlineEdit: boolean;
  allowViewSave?: boolean;
  allowViewSharing?: boolean;
  canEditRow?: (row: TData) => boolean;
  canDeleteRow?: (row: TData) => boolean;
  canDuplicateRow?: (row: TData) => boolean;
  canSelectRow?: (row: TData) => boolean;
  showToolbar: boolean;
  showToolbarHeader: boolean;
  /** Clear search and filters while preserving display options. */
  showClearFilters?: boolean;
  /** Backwards-compatible alias for `showClearFilters`. */
  showResetFilters?: boolean;
  export: boolean;
  bulkExport: boolean;
  actionsAsIcons: boolean;
  density: TableDensity;
  layoutPreset?: TableLayoutPreset;
  displayModes?: TableDisplayMode[];
  defaultDisplayMode?: TableDisplayMode;
  kanban?: TableKanbanConfig;
  gallery?: TableGalleryConfig;
  emptyState?: TableEmptyStateConfig;
  defaultPageSize: number;
  /** Enable the column drag-and-drop feature and its controls. */
  enableColumnDnd?: boolean;
  /** Initial column drag-and-drop preference when no saved preference exists. */
  enableColumnDragDropByDefault: boolean;
  enableColumnFilters: boolean;
  /** Catalogue defaults; explicit component props take precedence. */
  enableAdvancedFilters?: boolean;
  syncUrl?: boolean;
  searchDebounceMs?: number;
  enableColumnPinning?: boolean;
  enableMultiRowSelection: boolean;
  enablePagination: boolean;
  enableRowSelection: boolean;
  enableRowClickEdit?: boolean;
  rowClickMode?: TableRowClickMode;
  enableSorting: boolean;
  enableViews?: boolean;
  pageSizeOptions: number[];
  dateDisplayPreset?: DateDisplayPreset;
  inlineEdit?: TableInlineEditConfig;
  enableCalculations?: boolean;
  enableGrouping?: boolean;
  /** Keep selected row IDs when search, filters, sorting, or grouping changes. */
  preserveSelectionOnQuery?: boolean;
}

export interface TableTranslationsConfig {
  keys: Record<string, string>;
  namespace: string;
}

export type FormMode = "create" | "edit";
export type FormPresentation = "drawer" | "modal";
export type FormFieldType =
  | "checkbox"
  | "collection"
  | "custom"
  | "date"
  | "dynamic-value"
  | "dynamicValue"
  | "multiSelect"
  | "number"
  | "radio"
  | "select"
  | "select-with-add-new"
  | "switch"
  | "tablePicker"
  | "text"
  | "textarea"
  | "url"
  | "value-type";

export interface FormFieldContext<TData extends TableRecord = TableRecord> {
  /** Present only in the generated bulk editor; the normal edit form stays independent. */
  bulkEdit?: {
    ids: readonly string[];
    rows: readonly TData[];
    fields: readonly string[];
  };
  formType?: string;
  initialData?: Partial<TableRecord>;
  /** Locale inherited from the table that owns the generated form. */
  locale?: string;
  mode: FormMode;
  row?: TData;
  tableId?: string;
  tableType?: string;
  values: TableRecord;
  setFieldValue?: (name: string, value: unknown) => void;
  touchField?: (name: string) => void;
  /** Resolved table translations inherited by nested declarative fields. */
  translations?: DataTableTranslations;
}

export interface VueFormFieldApi {
  handleBlur: () => void;
  handleChange: (value: unknown) => void;
  name: string;
  state: {
    meta: { errors: string[]; isValid: boolean; isTouched?: boolean };
    value: unknown;
  };
}

export interface CollectionFieldCreateAction {
  id?: string;
  label: string;
  createItem: (items: readonly TableRecord[]) => TableRecord;
}

export interface CollectionFieldColumnDefinition {
  id: string;
  header: string;
  render?: (item: TableRecord, index: number) => VNodeChild;
}

export interface TablePickerFieldConfig<
  TRow extends TableRecord = TableRecord,
  TFormData extends TableRecord = TableRecord,
> {
  /** The nested table catalogue identifier. */
  tableType: string;
  /** A complete table catalogue, optionally derived from the current form. */
  config:
    | TableConfig<TRow>
    | ((context: FormFieldContext<TFormData>) => TableConfig<TRow>);
  /** Optional local rows, optionally derived from the current form. */
  data?: TRow[] | ((context: FormFieldContext<TFormData>) => TRow[]);
  /** Optional server and view contracts for the nested table. */
  actions?:
    | TableActions<TRow>
    | ((
        context: FormFieldContext<TFormData>
      ) => TableActions<TRow> | undefined);
  /** Convert a table row to the stable string ID used by table selection. */
  getRowId?: (row: TRow) => string;
  /** Convert a selected string row ID to the value stored in the form. */
  parseValue?: (id: string) => unknown;
  /** Allow several selected values. Defaults to true. */
  multiple?: boolean;
  /** Toggle a row when its non-interactive area is clicked. Defaults to true. */
  selectOnRowClick?: boolean;
  /** Limit the scrolling table body height. */
  maxHeight?: string;
  /** Keep the nested table state out of the page URL by default. */
  syncUrl?: boolean;
  locale?: string;
  translations?: DataTableTranslations;
  initialViews?: TableView[];
  initialActiveViewId?: string;
}

export interface FormFieldDefinition<TData extends TableRecord = TableRecord> {
  /** Exclude unique or otherwise unsafe fields from the generated bulk editor. */
  bulkEdit?: boolean;
  name: string;
  label: string;
  type: FormFieldType;
  description?: string;
  labelKey?: string;
  descriptionKey?: string;
  placeholderKey?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean | ((context: FormFieldContext<TData>) => boolean);
  hidden?: boolean | ((context: FormFieldContext<TData>) => boolean);
  defaultValue?: unknown;
  options?:
    | SelectOption[]
    | ((context: FormFieldContext<TData>) => MaybePromise<SelectOption[]>);
  /** Only these value changes reload dependent options. */
  optionDependencies?: string[];
  /** Change this key when the tenant or permission scope changes. */
  optionsScope?: string | number;
  searchOptions?: (
    query: string,
    context: FormFieldContext<TData>,
    signal: AbortSignal
  ) => MaybePromise<SelectOption[]>;
  resolveOptions?: (
    values: unknown[],
    context: FormFieldContext<TData>,
    signal: AbortSignal
  ) => MaybePromise<SelectOption[]>;
  createOption?: (
    label: string,
    context: FormFieldContext<TData>,
    signal: AbortSignal
  ) => MaybePromise<SelectOption>;
  searchMinLength?: number;
  searchDebounceMs?: number;
  schema?: ZodType;
  inputType?: "email" | "password" | "search" | "tel" | "text";
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  itemFields?: FormFieldDefinition[];
  collectionMode?: "inline" | "dialog";
  createItem?: (items: readonly TableRecord[]) => TableRecord;
  createActions?: CollectionFieldCreateAction[];
  columns?: CollectionFieldColumnDefinition[];
  tablePicker?: TablePickerFieldConfig<TableRecord, TData>;
  addLabel?: string;
  emptyLabel?: string;
  itemLabel?: string;
  getItemKey?: (item: TableRecord, index: number) => string;
  renderItemForm?: (props: {
    disabled?: boolean;
    index: number | null;
    item: TableRecord;
    onChange: (item: TableRecord) => void;
  }) => VNodeChild;
  validateItem?: (item: TableRecord, index: number | null) => string[];
  validateItems?: (items: readonly TableRecord[]) => string[];
  component?: Component;
  renderField?: (props: {
    field: VueFormFieldApi;
    form: {
      getFieldValue: (name: string) => unknown;
      setFieldValue: (name: string, value: unknown) => void;
    };
  }) => VNodeChild;
  dependsOn?: { field: string; transform: (value: unknown) => unknown };
  valueTypeField?: string;
  supportedTypes?: Array<"boolean" | "json" | "number" | "string">;
  optionsLoader?: () => Promise<string[]>;
  onAddNew?: () => void;
  optionKeys?: string[];
  minDate?: Date | string;
  maxDate?: Date | string;
  format?: string;
  variant?: "checkbox" | "switch";
  showMetaPreview?: boolean;
}

export interface FormSectionDefinition {
  id: string;
  title?: string;
  titleKey?: string;
  description?: string;
  descriptionKey?: string;
  fields: string[];
  columns?: 1 | 2 | 3;
}

export interface FormConfig<TData extends TableRecord = TableRecord> {
  id: string;
  title?: string | ((mode: FormMode, row?: TData) => string);
  description?: string;
  fields: FormFieldDefinition<TData>[];
  defaultValues?: Partial<TableRecord>;
  sections?: FormSectionDefinition[];
  presentation?: FormPresentation;
  width?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Full values remain the default; patch mode sends only changed declared fields. */
  submitMode?: "full" | "patch";
  loadInitialValues?: (
    row: TData | undefined,
    context: FormFieldContext<TData>,
    signal: AbortSignal
  ) => MaybePromise<TableRecord>;
  schema?: ZodType;
  translations?: { keys: Record<string, string>; namespace: string };
  transform?: (
    values: TableRecord,
    context: FormFieldContext<TData>
  ) => MaybePromise<TableRecord>;
}

export interface TableFormConfig {
  /** Defaults to catalogue when getFormConfig is supplied, otherwise JSON. */
  bulkEditMode?: "catalogue" | "json";
  createFormType?: string;
  editFormType?: string;
  resolveEditFormType?: (row: TableRecord) => string | undefined;
  presentation?: FormPresentation;
  width?: string;
}

export interface TableConfig<TData extends TableRecord = TableRecord> {
  id: string;
  icon?: string;
  columns: TableColumnsConfig<TData>;
  table: TableBehaviorConfig<TData>;
  translations: TableTranslationsConfig;
  form?: TableFormConfig;
  toolbarActions?: ToolbarActionsInput<TData>;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
}

export interface SortItem {
  id: string;
  desc: boolean;
}
export type SortingState = SortItem[];
export interface ColumnFilter {
  id: string;
  value: unknown;
}
export type ColumnFiltersState = ColumnFilter[];
export type ColumnVisibilityState = Record<string, boolean>;
export interface ColumnPinningState {
  left: string[];
  right: string[];
}
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export type AdvancedFilterOperator =
  | "after"
  | "before"
  | "between"
  | "contains"
  | "endsWith"
  | "equals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "in"
  | "is"
  | "isNot"
  | "isAnyOf"
  | "isNoneOf"
  | "containsAll"
  | "containsNone"
  | "isEmpty"
  | "isFalse"
  | "isNotEmpty"
  | "isTrue"
  | "lessThan"
  | "lessThanOrEqual"
  | "notContains"
  | "notEquals"
  | "notIn"
  | "startsWith";

export interface AdvancedFilter {
  id: string;
  columnId: string;
  operator: AdvancedFilterOperator;
  values?: unknown;
  isActive?: boolean;
  type?: ColumnType;
}

export interface AdvancedFiltersState {
  filters: AdvancedFilter[];
  joinOperator: "and" | "or";
}

export interface TableViewConfig {
  /** Canonical aliases shared with React; historical Vue names remain supported. */
  globalSearch?: string;
  columnFilters?: ColumnFiltersState;
  columnPinning?: ColumnPinningState;
  search?: string;
  filters?: ColumnFiltersState;
  advancedFilters?: AdvancedFiltersState | AdvancedFilter[];
  sorting?: SortingState;
  columnVisibility?: ColumnVisibilityState;
  columnOrder?: string[];
  displayMode?: TableDisplayMode;
  kanban?: TableKanbanViewConfig;
  gallery?: TableGalleryViewConfig;
  grouping?: string[];
  pinning?: ColumnPinningState;
  pageSize?: number;
}

export interface TableView {
  id: string;
  tableId: string;
  name: string;
  config: TableViewConfig;
  isDefault?: boolean;
  isGlobal?: boolean;
  isSystem?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateTableViewInput {
  tableId: string;
  tableType?: string;
  name: string;
  config: TableViewConfig;
  isGlobal?: boolean;
}

export interface UpdateTableViewInput {
  tableId?: string;
  tableType?: string;
  name?: string;
  config?: TableViewConfig;
  isGlobal?: boolean;
}

export interface TableViewActionResult<T = TableView> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface TableViewActions {
  list?: (context: {
    tableId: string;
    tableType?: string;
  }) => MaybePromise<TableViewActionResult<TableView[]> | TableView[]>;
  create?: (input: CreateTableViewInput) => MaybePromise<TableViewActionResult>;
  update?: (
    id: string,
    input: UpdateTableViewInput
  ) => MaybePromise<TableViewActionResult>;
  delete?: (
    id: string,
    context: { tableId: string; tableType?: string }
  ) => MaybePromise<TableViewActionResult>;
}

export interface TableListParams {
  limit?: number;
  orderBy?: Record<string, string>;
  q?: string;
  globalSearch?: string;
  page: number;
  pageSize: number;
  search: string;
  filters: Record<string, unknown>;
  advancedFilters: AdvancedFilter[];
  advancedFilterJoin: "and" | "or";
  sorting: SortingState;
  grouping: string[];
}

export interface TableListResult<TData extends TableRecord = TableRecord> {
  data: TData[];
  meta?: { pageCount?: number; totalCount?: number };
}

export interface TableActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** On partial bulk failure, the complete subset of targeted IDs that still need saving. */
  failedIds?: string[];
}

export interface BulkActionResult extends TableActionResult {
  /** Clear the rows targeted when the action started without affecting later selections. */
  clearSelection?: boolean;
  /** Dismiss the bulk menu independently from row selection. */
  closeMenu?: boolean;
  /** Display application-provided success or error feedback above the table. */
  message?: string;
}

// biome-ignore lint/suspicious/noConfusingVoidType: Bulk callbacks may let the application own its form, feedback, and follow-up behavior.
export type BulkActionHandlerResult = BulkActionResult | void;

export interface TableAggregateParams {
  advancedFilterJoin?: "and" | "or";
  filters: Record<string, unknown>;
  advancedFilters: AdvancedFilter[];
  search: string;
  calculations: Record<string, CalculationType>;
  locale: string;
}

export interface TableActions<TData extends TableRecord = TableRecord> {
  list?: (params: TableListParams) => MaybePromise<TableListResult<TData>>;
  aggregate?: (params: TableAggregateParams) => MaybePromise<{
    results: Record<string, unknown>;
    meta?: { totalCount?: number };
  }>;
  create?: (data: TableRecord) => MaybePromise<TableActionResult<TData>>;
  update?: (
    id: string,
    data: TableRecord
  ) => MaybePromise<TableActionResult<TData>>;
  delete?: (id: string) => MaybePromise<TableActionResult>;
  duplicate?: (id: string) => MaybePromise<TableActionResult<TData>>;
  bulkDelete?: (ids: string[]) => MaybePromise<TableActionResult>;
  bulkCopy?: (ids: string[]) => MaybePromise<TableActionResult<TData[]>>;
  bulkUpdate?: (
    ids: string[],
    data: TableRecord
  ) => MaybePromise<TableActionResult<TData[]>>;
  views?: TableViewActions;
  [key: string]: unknown;
}

export interface BulkActionContext<TData extends TableRecord = TableRecord> {
  selectedRows: TData[];
  selectedIds: string[];
  count: number;
  clearSelection: () => void;
  refresh: () => Promise<void>;
}

export interface BulkAction<TData extends TableRecord = TableRecord> {
  id: string;
  label: string;
  icon?: Component;
  variant?: "danger" | "default" | "outline";
  disabled?: boolean | ((context: BulkActionContext<TData>) => boolean);
  confirm?: { title: string; description?: string; confirmLabel?: string };
  handler: (
    context: BulkActionContext<TData>
  ) => MaybePromise<BulkActionHandlerResult>;
}

export interface ToolbarActionContext<TData extends TableRecord = TableRecord>
  extends BulkActionContext<TData> {
  actionsAsIcons: boolean;
  data: TData[];
  hasListAction: boolean;
  isCreateEnabled: boolean;
  isExportEnabled: boolean;
  isExporting: boolean;
  isFooterCalculationsEnabled: boolean;
  isMobile: boolean;
  selectedCount: number;
  selectedOriginalRows: TData[];
  selectedRowIds: string[];
  tableActions?: TableActions<TData>;
  tableId: string;
  tableType?: string;
}

export interface ToolbarAction<TData extends TableRecord = TableRecord> {
  id: string;
  label: string;
  icon?: Component;
  variant?: "default" | "destructive" | "ghost" | "outline" | "secondary";
  disabled?: boolean | ((context: ToolbarActionContext<TData>) => boolean);
  loading?: boolean;
  showInIconMode?: boolean;
  tooltip?: string;
  /** React-compatible action callback. */
  onClick?: (context: ToolbarActionContext<TData>) => MaybePromise<void>;
  /** @deprecated Use `onClick` for cross-framework catalogues. */
  handler?: (context: ToolbarActionContext<TData>) => MaybePromise<void>;
  requiresFooterCalculations?: boolean;
}

export type ToolbarActionsInput<TData extends TableRecord = TableRecord> =
  | ToolbarAction<TData>[]
  | ((context: ToolbarActionContext<TData>) => ToolbarAction<TData>[]);

export type ToolbarActionsPlacement =
  | "after-export"
  | "before-create"
  | "between-create-export";

export interface DataTableTranslations {
  [key: string]: unknown;
  search?: string;
  create?: string;
  edit?: string;
  delete?: string;
  duplicate?: string;
  export?: string;
  filters?: string;
  columns?: string;
  views?: string;
  saveView?: string;
  noResults?: string;
  loading?: string;
  previous?: string;
  next?: string;
  selected?: string;
  rowsPerPage?: string;
  actions?: string;
  openActions?: string;
  options?: string;
  properties?: string;
  sort?: string;
  group?: string;
  calculations?: string;
  calculationsOn?: string;
  calculationsOff?: string;
  reset?: string;
  copyLink?: string;
  ascending?: string;
  descending?: string;
  addSort?: string;
  all?: string;
  none?: string;
  selectAll?: string;
  bulkEdit?: string;
  copy?: string;
  cancel?: string;
  confirm?: string;
}

export interface YayawTableProps<TData extends TableRecord = TableRecord> {
  tableType: string;
  tableId?: string;
  formType?: string;
  className?: string;
  config?: TableConfig<TData>;
  getTableConfig?: (tableType: string) => TableConfig<TData> | undefined;
  getTableActions?: (tableType: string) => TableActions<TData> | undefined;
  getFormConfig?: (
    formType: string,
    context?: FormFieldContext<TData>
  ) => FormConfig<TData> | undefined;
  data?: TData[];
  initialData?: TData[];
  initialRowCount?: number;
  initialPageCount?: number;
  initialViews?: TableView[];
  initialActiveViewId?: string;
  title?: string;
  description?: string;
  locale?: string;
  translations?: DataTableTranslations;
  enableAdvancedFilters?: boolean;
  enableToolbar?: boolean;
  enableViews?: boolean;
  syncUrl?: boolean;
  customBulkActions?: BulkAction<TData>[];
  searchDebounceMs?: number;
  toolbarActions?: ToolbarActionsInput<TData>;
  toolbarActionsPlacement?: ToolbarActionsPlacement;
  rowSelection?: Record<string, boolean>;
  getRowId?: (row: TData) => string;
  onRowActivate?: (row: TData, event: MouseEvent) => void;
  onRowClick?: (url: string, row: TData, event: MouseEvent) => void;
  onRowSelectionChange?: (selection: Record<string, boolean>) => void;
  onBulkDelete?: (rows: TData[]) => MaybePromise<BulkActionHandlerResult>;
  onBulkEdit?: (
    rows: TData[],
    /** Retained for source compatibility; application-owned callbacks are triggered without a built-in patch. */
    patch?: TableRecord
  ) => MaybePromise<BulkActionHandlerResult>;
  onBulkCopy?: (rows: TData[]) => MaybePromise<BulkActionHandlerResult>;
  onBulkExport?: (rows: TData[]) => MaybePromise<BulkActionHandlerResult>;
  onExport?: (rows: TData[]) => MaybePromise<void>;
  columnTypeMapping?: Record<
    string,
    "date" | "multiSelect" | "number" | "select" | "text"
  >;
  queryClient?: QueryClient;
}
