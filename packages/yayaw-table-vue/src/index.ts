import type { App, Plugin } from "vue";
import YayawDataTableComponent from "./components/YayawDataTable.vue";
import "./styles.css";

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
export * from "./translations";
export * from "./types";

export const YayawTablePlugin: Plugin = {
  install(app: App): void {
    app.component("YayawDataTable", YayawDataTableComponent);
    app.component("DataTable", YayawDataTableComponent);
  },
};

export default YayawTablePlugin;
