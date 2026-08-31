import type { DefineComponent, Plugin } from "vue";
import type { YayawTableProps } from "./types";

export { useTableData } from "./composables/use-table-data";
export { useTableState } from "./composables/use-table-state";
export * from "./config";
export * from "./core";
export * from "./translations";
export * from "./types";

export declare const YayawDataTable: DefineComponent<YayawTableProps>;
export declare const DataTable: typeof YayawDataTable;
export declare const CatalogueForm: DefineComponent;
export declare const GalleryView: DefineComponent;
export declare const KanbanView: DefineComponent;
export declare const YayawTablePlugin: Plugin;
export default YayawTablePlugin;
