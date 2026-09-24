import type { DefineComponent, Plugin } from "vue";
import type { YayawTableProps } from "./types";

export { useTableData } from "./composables/use-table-data";
export { useTableState } from "./composables/use-table-state";
export * from "./config";
export * from "./core";
export type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
  DisplayModeRenderers,
  DisplayModeSettingsContext,
} from "./display-mode-renderer";
export * from "./translations";
export * from "./types";

export declare const YayawDataTable: DefineComponent<YayawTableProps>;
export declare const DataTable: typeof YayawDataTable;
export declare const CatalogueForm: DefineComponent;
/** Standalone form (no table state), e.g. on a public route. */
export declare const YayawTableForm: DefineComponent;
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
} from "./form-conditions";
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
} from "./form-view";
export declare const formRenderer: import("./display-mode-renderer").DisplayModeRenderer;
export declare const feedRenderer: import("./display-mode-renderer").DisplayModeRenderer;

export { default as RecordDetails } from "./components/details/RecordDetails.vue";
export {
  type FeedBodyRenderer,
  type FeedDateDisplay,
  type FeedDensity,
  type FeedTableSettings,
  type FeedViewSettings,
  formatFeedRelativeDate,
  normalizeFeedViewConfig,
} from "./feed-view";
export type {
  DetailActivity,
  DetailField,
  DetailPresentation,
  DetailRevertHandler,
  DetailSection,
  RecordDetailsConfig,
} from "./record-details";
export declare const GalleryView: DefineComponent;
export declare const KanbanView: DefineComponent;
export declare const YayawTablePlugin: Plugin;
export default YayawTablePlugin;

export type { TableActivityRecord } from "./activity-shortcuts";
export type {
  TableGalleryMediaConfig,
  TableGalleryPreviewSize,
  TableMediaSource,
} from "./media-contract";
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
export type {
  RecordPresentation,
  RecordPresentationConfig,
} from "./record-presentation";
