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
  LocationFieldDefinition,
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
  createLocationField,
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
// Feed view, built into the table (`table.feed: false` turns it off).
export { feedRenderer } from "./feed/feed-renderer";
// File tree view: folders and files linked by a parent column.
export { fileTreeRenderer } from "./filetree/filetree-renderer";
// Form view; public routes can import `form/yayaw-table-form` on its own.
export { formRenderer } from "./form/form-renderer";
export {
  YayawTableForm,
  type YayawTableFormProps,
} from "./form/yayaw-table-form";
export { createMemoryPlanningAdapter } from "./planning/adapter";
export { calculatePlanning, resolvedPlanningSnapshot } from "./planning/engine";
export {
  type PlanningFormatters,
  planningFormatters,
} from "./planning/format";
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
  type FeedBodyRenderer,
  type FeedDateDisplay,
  type FeedDensity,
  type FeedTableSettings,
  type FeedViewSettings,
  formatFeedRelativeDate,
  normalizeFeedViewConfig,
} from "./utils/feed-view";
export type {
  FileTreeActions,
  FileTreeHooks,
  FileTreeMoveInput,
  FileTreeMoveResult,
  FileTreeTableConfig,
  FileTreeViewSettings,
} from "./utils/filetree-model";
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
  formLocaleTag,
  normalizeFormText,
  resolveFormText,
} from "./utils/form-text";
export {
  type AcceptedPublicFormResponse,
  acceptFormHiddenFields,
  acceptPublicFormResponse,
  type BuildPublicFormSnapshotInput,
  buildPublicFormSnapshot,
  collectFormHiddenFields,
  evaluateFormView,
  type FormColumn,
  type FormConsentLink,
  type FormConsentQuestion,
  type FormConsentRecord,
  type FormDraft,
  type FormHiddenField,
  type FormHiddenSource,
  type FormItem,
  type FormLayout,
  type FormLinkActions,
  type FormLinkStatus,
  type FormPageContext,
  type FormProgress,
  type FormQuestion,
  type FormResponseMetadata,
  type FormSectionBreak,
  type FormSubmitMeta,
  type FormSubmitResult,
  type FormText,
  type FormViewSettings,
  formPageContext,
  formSettingsFromView,
  type PublicFormAcceptance,
  type PublicFormResponseInput,
  type PublicFormSnapshot,
  publicFormSnapshot,
  withFormServerContext,
} from "./utils/form-view";
// Location columns and the Map mode: shared helpers a host can use on its server.
export {
  boundsContain,
  distanceKm,
  formatLocation,
  type GeocodeAction,
  type GeocodeResult,
  type LocationBounds,
  type LocationValue,
  matchesLocationFilter,
  parseLocation,
} from "./utils/location-model";
export type {
  MapStyleChoice,
  MapTableConfig,
  MapViewSettings,
} from "./utils/map-model";
export type {
  TableGalleryMediaConfig,
  TableGalleryPreviewSize,
  TableMediaSource,
} from "./utils/media-contract";
export type {
  RecordPresentation,
  RecordPresentationConfig,
} from "./utils/record-presentation";
export type { BoundsScope, ListScope } from "./utils/scoped-rows";
export { createLocalTableViewActions } from "./utils/table-view-storage";
