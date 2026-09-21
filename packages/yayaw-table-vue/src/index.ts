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
  DetailActivity,
  DetailField,
  DetailPresentation,
  DetailRevertHandler,
  DetailSection,
  RecordDetailsConfig,
} from "./record-details";
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
