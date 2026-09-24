<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useTableContext } from "../context";
import type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
} from "../display-mode-renderer";
import { useModeSettingsContext } from "../composables/use-mode-settings-context";
import type { TableListParams, TableRecord } from "../types";
import { type FormSubmitResult, formSubmitResultFrom } from "../form-view";
import {
  canAddChartFilters,
  type ChartFilterRule,
  withChartFilters,
} from "../chart-model";
import { recordsDisplayMode } from "../display-modes";
import type { AdvancedFilter } from "../types";

const props = defineProps<{ renderer: DisplayModeRenderer }>();
const context = useTableContext();
const listAction = computed(() => {
  const list = context.actions.value?.list;
  return list
    ? async (params: Record<string, unknown>) =>
        await list(params as unknown as TableListParams)
    : undefined;
});
const listParams = computed(() => ({
  search: context.state.search.value || undefined,
  filters: Object.fromEntries(
    context.state.filters.value.map((filter) => [filter.id, filter.value])
  ),
  advancedFilters: context.state.advancedFilters.value,
  sorting: context.state.sorting.value,
}));
// Without a list action, renderers read every row matching the query.
const localRows = ref<TableRecord[]>([]);
const revision = ref(0);
watch(
  [() => context.data.rows.value, listParams, listAction],
  async () => {
    revision.value += 1;
    if (!listAction.value) {
      localRows.value = await context.loadAllMatchingRows();
    }
  },
  { immediate: true }
);
const canEditRow = (row: TableRecord): boolean =>
  Boolean(context.actions.value?.update) &&
  context.config.table.allowEdit !== false &&
  context.config.table.canEditRow?.(row) !== false;
const updateRow = async (
  row: TableRecord,
  patch: TableRecord
): Promise<boolean> => {
  const update = context.actions.value?.update;
  if (!update) return false;
  try {
    const result = await update(context.getRowId(row), patch, { row });
    if (!result.success) throw new Error(result.error ?? "Update failed");
    await context.refresh();
    return true;
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return false;
  }
};
const createRecord = async (values: TableRecord): Promise<FormSubmitResult> => {
  const create = context.actions.value?.create;
  if (!create || context.config.table.allowCreate === false) {
    return { ok: false };
  }
  // A thrown error surfaces as the form's generic "could not be sent" message.
  const result = formSubmitResultFrom(await create(values));
  if (result.ok) await context.refresh();
  return result;
};
const aggregateAction = computed(() => {
  const aggregate = context.actions.value?.aggregate;
  return aggregate
    ? async (params: Record<string, unknown>) =>
        await aggregate(params as unknown as Parameters<typeof aggregate>[0])
    : undefined;
});
// A clicked chart group: its rules join the view's filters, then the records show as a table.
const showRecords = (rules: Record<string, unknown>[]): boolean => {
  const current = context.state.advancedFilters.value;
  if (!canAddChartFilters(current)) return false;
  const merged = withChartFilters(current, rules as unknown as ChartFilterRule[]);
  context.state.advancedFilters.value = {
    filters: merged.filters as unknown as AdvancedFilter[],
    joinOperator: merged.joinOperator,
  };
  context.state.displayMode.value = recordsDisplayMode(
    context.state.offeredDisplayModes,
    context.state.displayMode.value
  );
  return true;
};
const settingsContext = useModeSettingsContext();
const renderContext = computed<DisplayModeRenderContext>(() => ({
  ...settingsContext.value,
  tableType: context.tableType ?? context.config.id,
  listParams: listParams.value,
  list: listAction.value,
  aggregate: aggregateAction.value,
  rows: localRows.value,
  advancedFilters: context.state.advancedFilters.value,
  groupBy: context.state.grouping.value[0] || undefined,
  showRecords,
  getRowId: (row) => context.getRowId(row),
  canEditRow,
  canCreate:
    context.config.table.allowCreate !== false &&
    Boolean(context.actions.value?.create),
  updateRow,
  openRow: (row, event) =>
    context.activateRow(row, event ?? new MouseEvent("click")),
  createRow: (initial) => context.openCreate(initial),
  createRecord,
  viewId: context.state.activeViewId.value ?? null,
  formLinks: context.actions.value?.formLinks,
  coloredTags: context.config.table.coloredTags !== false,
  revision: revision.value,
}));
</script>

<template>
  <component :is="props.renderer.view" :context="renderContext" />
</template>
