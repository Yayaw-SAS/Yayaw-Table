import type { QueryClient } from "@tanstack/vue-query";
import { type ComputedRef, type InjectionKey, inject, type Ref } from "vue";
import type { TableDataResult } from "./composables/use-table-data";
import type { TableStateRefs } from "./composables/use-table-state";
import type {
  BulkAction,
  DataTableTranslations,
  FormConfig,
  FormFieldContext,
  FormMode,
  TableActions,
  TableConfig,
  TableRecord,
  ToolbarAction,
} from "./types";

export interface OpenFormState {
  open: boolean;
  mode: FormMode;
  row?: TableRecord;
  formType?: string;
}

export interface TableContextValue<TData extends TableRecord = TableRecord> {
  config: TableConfig<TData>;
  actions: ComputedRef<TableActions<TData> | undefined>;
  state: TableStateRefs;
  data: TableDataResult<TData>;
  selection: Ref<Record<string, boolean>>;
  selectedRows: ComputedRef<TData[]>;
  matchingRowCount: ComputedRef<number>;
  isSelectingAll: Ref<boolean>;
  translations: ComputedRef<DataTableTranslations>;
  customBulkActions: ComputedRef<BulkAction<TData>[]>;
  toolbarActions: ComputedRef<ToolbarAction<TData>[]>;
  form: Ref<OpenFormState>;
  getRowId: (row: TData, index?: number) => string;
  getFormConfig?: (
    formType: string,
    context?: FormFieldContext<TData>
  ) => FormConfig<TData> | undefined;
  refresh: () => Promise<void>;
  openCreate: () => void;
  openEdit: (row: TData) => void;
  activateRow: (row: TData, event: MouseEvent) => void;
  emitSelection: () => void;
  clearSelection: () => void;
  selectAllMatching: () => Promise<number>;
  loadAllMatchingRows: () => Promise<TData[]>;
  status: Ref<{ type: "error" | "success"; message: string } | undefined>;
  queryClient: QueryClient;
  locale: string;
  onBulkDelete?: (rows: TData[]) => Promise<unknown> | unknown;
  onBulkEdit?: (
    rows: TData[],
    patch?: TableRecord
  ) => Promise<unknown> | unknown;
  onBulkCopy?: (rows: TData[]) => Promise<unknown> | unknown;
  onBulkExport?: (rows: TData[]) => Promise<unknown> | unknown;
  onExport?: (rows: TData[]) => Promise<void> | void;
}

export const tableContextKey = Symbol(
  "yayaw-table-vue"
) as InjectionKey<TableContextValue>;

export const useTableContext = <
  TData extends TableRecord = TableRecord,
>(): TableContextValue<TData> => {
  const value = inject(tableContextKey);
  if (!value) {
    throw new Error(
      "YaYaw Table components must be used inside <YayawDataTable>."
    );
  }
  return value as TableContextValue<TData>;
};
