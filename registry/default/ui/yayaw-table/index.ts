/**
 * Main export file for the DataTable component
 * This file exports all components, hooks, and atoms for the DataTable
 */

export type {
  BulkAction,
  BulkActionConfirmConfig,
  BulkActionContext,
  BulkActionHandler,
  BulkActionHandlerResult,
  BulkActionResult,
  BulkActionVariant,
  CustomBulkActionsInput,
} from "./components/bulk-actions";
export type {
  ActionItem,
  ActionItem as RowActionItem,
} from "./components/columns/actions-column";
// Main component
export { DataTable } from "./components/data-table";
export type {
  AnyFieldDefinition,
  CollectionFieldActionLabels,
  CollectionFieldColumnDefinition,
  CollectionFieldCreateAction,
  CollectionFieldDefinition,
  CollectionFieldItem,
  DateFieldDefinition,
  FieldValues,
  FormAction,
  FormBlock,
  FormBlockContext,
  FormConfig,
  FormConfigContext,
  FormConfigMode,
  FormFieldApi,
  FormSectionDefinition,
  RadioFieldDefinition,
  TablePickerFieldConfig,
  TablePickerFieldDefinition,
} from "./components/forms";
export {
  CatalogueForm,
  CollectionEditor,
  CollectionField,
  createCollectionField,
  createDateField,
  createRadioField,
  createTablePickerField,
  defineFormConfig,
  FormBuilder,
  TablePickerField,
} from "./components/forms";
export type {
  CatalogueFormLayoutConfig,
  TableFormConfig,
} from "./config/form-config";
export type {
  ColumnDefinition,
  InlineEditColumnConfig,
  InlineEditEditor,
  InlineEditOption,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableEmptyStateConfig,
  TableInlineEditConfig,
  TableLayoutPreset,
  TableRowClickMode,
  TableTranslationsConfig,
} from "./config/helpers";
// Config helper and types
export { defineTableConfig } from "./config/helpers";
// Form view; public routes can import `form/yayaw-table-form` on its own.
export { formRenderer } from "./form/form-renderer";
export {
  YayawTableForm,
  type YayawTableFormProps,
} from "./form/yayaw-table-form";
export { createMemoryPlanningAdapter } from "./planning/adapter";
export { calculatePlanning, resolvedPlanningSnapshot } from "./planning/engine";
export {
  PLANNING_LABEL_KEYS,
  type PlanningSurfaceLabels,
  planningLabelOverrides,
  planningLabels,
} from "./planning/labels";
export {
  type PlanningRowAdapter,
  planningTasksFromRows,
} from "./planning/rows";
export {
  canDeriveRowsPlanning,
  createRowsPlanningAdapter,
  type RowsPlanningAdapterOptions,
} from "./planning/rows-adapter";
export {
  createPlanningTransactions,
  type PlanningTransactionOptions,
} from "./planning/transactions";
export type * from "./planning/types";
export * from "./types/column-types";
export * from "./types/date-types";
export * from "./types/display-types";
export * from "./types/filter-types";
export * from "./types/footer-types";
export * from "./types/table-types";
export * from "./types/toolbar-types";
export * from "./types/translations";
// Core types used in docs
export type {
  CreateTableViewInput,
  TableView,
  TableViewActionContext,
  TableViewActionResult,
  TableViewActions,
  TableViewConfig,
  UpdateTableViewInput,
} from "./types/view-types";
export type { TableActivityRecord } from "./utils/activity-shortcuts";
export {
  type Condition,
  type ConditionField,
  type ConditionFieldType,
  type ConditionGroup,
  type ConditionOperator,
  type ConditionValue,
  evaluateForm,
  type FormEvaluation,
  type FormRule,
  type FormRuleAction,
  normalizeRules,
  type RuleIssue,
  validateRules,
} from "./utils/form-conditions";
export {
  acceptPublicFormResponse,
  type BuildPublicFormSnapshotInput,
  buildPublicFormSnapshot,
  evaluateFormView,
  type FormColumn,
  type FormDraft,
  type FormItem,
  type FormLayout,
  type FormLinkActions,
  type FormLinkStatus,
  type FormProgress,
  type FormQuestion,
  type FormSectionBreak,
  type FormSubmitResult,
  type FormViewSettings,
  formSettingsFromView,
  type PublicFormSnapshot,
  publicFormSnapshot,
} from "./utils/form-view";
export type {
  TableGalleryMediaConfig,
  TableGalleryPreviewSize,
  TableMediaSource,
} from "./utils/media-contract";
export type {
  RecordPresentation,
  RecordPresentationConfig,
} from "./utils/record-presentation";
export { createLocalTableViewActions } from "./utils/table-view-storage";
