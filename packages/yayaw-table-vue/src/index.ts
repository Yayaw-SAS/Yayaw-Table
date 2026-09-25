import type { App, Plugin } from "vue";
import YayawDataTableComponent from "./components/YayawDataTable.vue";
import "./styles.css";

export { default as RecordDetails } from "./components/details/RecordDetails.vue";
export { default as CatalogueForm } from "./components/forms/CatalogueForm.vue";
export { default as GalleryView } from "./components/gallery/GalleryView.vue";
export { default as KanbanView } from "./components/kanban/KanbanView.vue";
export {
  default as DataTable,
  default as YayawDataTable,
} from "./components/YayawDataTable.vue";
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
export {
  type FacetColumn,
  type FacetColumnSettings,
  type FacetCounts,
  type FacetEntry,
  type FacetKind,
  facetAggregateParams,
  facetCountParams,
  loadFacetCounts,
  resolveFacets,
  type TableFacetsConfig,
  toggleFacetValue,
} from "./facets-model";
export { feedRenderer } from "./feed/feed-renderer";
export {
  type FeedBodyRenderer,
  type FeedDateDisplay,
  type FeedDensity,
  type FeedTableSettings,
  type FeedViewSettings,
  formatFeedRelativeDate,
  normalizeFeedViewConfig,
} from "./feed-view";
export { fileTreeRenderer } from "./filetree/filetree-renderer";
export type {
  FileTreeActions,
  FileTreeHooks,
  FileTreeMoveInput,
  FileTreeMoveResult,
  FileTreeTableConfig,
  FileTreeTableOptions,
  FileTreeViewSettings,
} from "./filetree-model";
export {
  type FolderDirectory,
  type FolderEntry,
  folderChoiceOf,
  loadFolderDirectory,
  toggleFolderChoice,
} from "./folder-directory";

export { formRenderer } from "./form/form-renderer";
export { default as YayawTableForm } from "./form/YayawTableForm.vue";
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
  formLocaleTag,
  normalizeFormText,
  resolveFormText,
} from "./form-text";
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
} from "./form-view";
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
} from "./location-model";
export type {
  MapStyleChoice,
  MapTableConfig,
  MapViewSettings,
} from "./map-model";
export type {
  DetailActivity,
  DetailField,
  DetailPresentation,
  DetailRevertHandler,
  DetailSection,
  RecordDetailsConfig,
} from "./record-details";
export type { BoundsScope, ListScope } from "./scoped-rows";
export * from "./translations";
export * from "./types";

export const YayawTablePlugin: Plugin = {
  install(app: App): void {
    app.component("YayawDataTable", YayawDataTableComponent);
    app.component("DataTable", YayawDataTableComponent);
  },
};

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
export type {
  RecordPresentation,
  RecordPresentationConfig,
} from "./record-presentation";
