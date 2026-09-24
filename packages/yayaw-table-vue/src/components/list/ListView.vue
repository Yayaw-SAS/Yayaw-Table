<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCardRows } from "../../composables/use-card-rows";
import { useListSettings } from "../../composables/use-list-settings";
import { displayCellValue } from "../../core";
import { GripVertical } from "lucide-vue-next";
import { isManualOrder, moveInOrder, REORDER_ROW_ATTRIBUTE, reorderRowAt } from "../../manual-order";
import { selectionAfterClick } from "../../selection-interaction";
import { fieldText } from "../../table-contracts";
import type { ColumnDefinition, TableRecord } from "../../types";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import RowActions from "../table/RowActions.vue";
import TableEmptyState from "../table/TableEmptyState.vue";

const EMPTY_GROUP_LABEL = "No value";
const {
  context,
  translate,
  columns,
  titleColumn,
  propertyIds,
  showLabels,
  wrap,
  showActions,
  propertyAlign,
  visibleProperties,
} = useListSettings();
const loadedRows = useCardRows();
// A move shows at once; the next server result replaces it.
const pendingOrder = ref<string[] | null>(null);
watch(loadedRows, () => {
  pendingOrder.value = null;
});
const rows = computed(() => {
  const order = pendingOrder.value;
  if (!order) {
    return loadedRows.value;
  }
  const position = new Map(order.map((id, index) => [id, index]));
  return [...loadedRows.value].sort(
    (left, right) =>
      (position.get(context.getRowId(left)) ?? 0) -
      (position.get(context.getRowId(right)) ?? 0)
  );
});
const column = (id: string): ColumnDefinition | undefined =>
  columns.value.find((item) => item.id === id);
const value = (row: TableRecord, id: string): unknown =>
  column(id)?.accessorFn
    ? column(id)?.accessorFn?.(row)
    : row[column(id)?.accessorKey ?? id];
const groupBy = computed(() => context.state.grouping.value[0] ?? "");
const properties = computed(() =>
  visibleProperties(
    propertyIds.value.filter(
      (id) => id !== titleColumn.value && id !== groupBy.value && column(id)
    )
  )
);
const sections = computed(() => {
  if (!groupBy.value) {
    return [{ id: "all", label: "", rows: rows.value }];
  }
  // Headings read the value as the table shows it; ids stay the raw value.
  const groups = new Map<string, { label: string; rows: TableRecord[] }>();
  for (const row of rows.value) {
    const raw = value(row, groupBy.value);
    const empty = raw === null || raw === undefined || raw === "";
    const key = empty ? EMPTY_GROUP_LABEL : String(raw);
    const section = groups.get(key) ?? {
      label: empty
        ? EMPTY_GROUP_LABEL
        : fieldText(raw, column(groupBy.value), context.locale) || key,
      rows: [],
    };
    section.rows.push(row);
    groups.set(key, section);
  }
  return [...groups].map(([key, section]) => ({
    id: key,
    label: section.label,
    rows: section.rows,
  }));
});
/** The title as read aloud: option labels, number and date formats. */
const titleText = (row: TableRecord): string =>
  fieldText(value(row, titleColumn.value), column(titleColumn.value), context.locale, row);
const groupHeader = computed(
  () => column(groupBy.value)?.header ?? groupBy.value
);
const orderedRows = computed(() =>
  sections.value.flatMap((section) => section.rows)
);
const checkboxShift = ref(false);
const canReorder = computed(
  () =>
    context.config.table.manualOrder === true &&
    typeof context.actions.value?.reorder === "function" &&
    context.config.table.allowEdit !== false &&
    isManualOrder(context.state.sorting.value)
);
const canReorderRow = (row: TableRecord): boolean =>
  canReorder.value && context.config.table.canEditRow?.(row) !== false;
const reorderHint = computed(() =>
  translate("reorderHint", "Drag, or press Alt+Arrow keys, to reorder")
);
const dragged = ref<TableRecord>();
const target = ref<TableRecord>();
const sectionOf = (row: TableRecord) =>
  sections.value.find((section) => section.rows.includes(row));
const startDrag = (row: TableRecord, event: PointerEvent): void => {
  event.preventDefault();
  (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  dragged.value = row;
};
const trackDrag = (event: PointerEvent): void => {
  const row = dragged.value;
  if (!row) {
    return;
  }
  const id = reorderRowAt(event.clientX, event.clientY);
  const over = rows.value.find((item) => context.getRowId(item) === id);
  // Moves stay within a group: the manual order never edits the grouped value.
  target.value = over && sectionOf(over) === sectionOf(row) ? over : undefined;
};
const endDrag = async (): Promise<void> => {
  const row = dragged.value;
  const over = target.value;
  dragged.value = undefined;
  target.value = undefined;
  const section = over && sectionOf(over);
  if (row && over && row !== over && section) {
    await moveRow(row, section.rows.indexOf(over));
  }
};
const cancelDrag = (): void => {
  dragged.value = undefined;
  target.value = undefined;
};
const moveRow = async (row: TableRecord, toIndex: number): Promise<void> => {
  const section = sectionOf(row);
  const reorder = context.actions.value?.reorder;
  if (!(section && reorder && canReorderRow(row))) {
    return;
  }
  const moved = moveInOrder(
    section.rows.map((item) => context.getRowId(item)),
    context.getRowId(row),
    toIndex
  );
  if (!moved) {
    return;
  }
  const sectionIds = new Set(moved.ids);
  const others = rows.value
    .map((item) => context.getRowId(item))
    .filter((id) => !sectionIds.has(id));
  const first = rows.value.findIndex((item) => sectionIds.has(context.getRowId(item)));
  others.splice(Math.max(0, first), 0, ...moved.ids);
  pendingOrder.value = others;
  try {
    const result = await reorder(
      {
        viewId: context.state.activeViewId.value ?? null,
        id: context.getRowId(row),
        previousId: moved.previousId,
        nextId: moved.nextId,
      },
      { row }
    );
    if (!result.success) {
      throw new Error(result.error ?? "Reorder failed");
    }
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  await context.refresh();
};
const reorderKey = async (row: TableRecord, event: KeyboardEvent): Promise<boolean> => {
  if (!(event.altKey && canReorderRow(row) && ["ArrowUp", "ArrowDown"].includes(event.key))) {
    return false;
  }
  event.preventDefault();
  const section = sectionOf(row);
  if (section) {
    await moveRow(row, section.rows.indexOf(row) + (event.key === "ArrowUp" ? -1 : 1));
  }
  return true;
};
const onKeydown = async (row: TableRecord, event: KeyboardEvent): Promise<void> => {
  if (!(await reorderKey(row, event))) {
    activate(row, event);
  }
};
const selectable = (row: TableRecord): boolean =>
  context.config.table.canSelectRow?.(row) !== false;
const toggleSelection = (
  row: TableRecord,
  checked: boolean,
  shift = false
): void => {
  if (!selectable(row)) {
    return;
  }
  context.selection.value = selectionAfterClick({
    scope: context.selection,
    rows: orderedRows.value
      .filter(selectable)
      .map((item) => ({ id: context.getRowId(item) })),
    selection: context.selection.value,
    id: context.getRowId(row),
    selected: checked,
    shift,
    multiple: context.config.table.enableMultiRowSelection,
  });
};
const captureSelection = (row: TableRecord, event: MouseEvent): void => {
  if (
    !(event.shiftKey || event.metaKey || event.ctrlKey) ||
    !context.config.table.enableRowSelection ||
    (event.target as Element).closest(".yayaw-list-select")
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  toggleSelection(
    row,
    event.shiftKey || !context.selection.value[context.getRowId(row)],
    event.shiftKey
  );
};
const activate = (row: TableRecord, event: MouseEvent | KeyboardEvent): void => {
  if (
    event instanceof KeyboardEvent &&
    (event.target !== event.currentTarget || !["Enter", " "].includes(event.key))
  ) {
    return;
  }
  if (
    event.target instanceof Element &&
    event.target.closest("button,a,input,select,textarea,label")
  ) {
    return;
  }
  if (event instanceof KeyboardEvent) {
    event.preventDefault();
  }
  context.activateRow(row, event as MouseEvent);
};
</script>

<template>
  <TableEmptyState
    v-if="!rows.length && !context.data.isLoading.value && !context.data.error.value && context.config.table.emptyState?.show !== false"
    class="yayaw-card-empty"
  />
  <div v-else class="yayaw-list">
    <section v-for="section in sections" :key="section.id" class="yayaw-list-section">
      <div v-if="section.label" class="yayaw-list-group">
        <h3><span class="yayaw-list-group-label">{{ groupHeader }}: </span>{{ section.label }}</h3>
        <span class="yayaw-count">{{ section.rows.length }}</span>
      </div>
      <ul>
        <li
          v-for="row in section.rows"
          :key="context.getRowId(row)"
          v-bind="canReorder ? { [REORDER_ROW_ATTRIBUTE]: context.getRowId(row) } : {}"
          :class="{ selected: context.selection.value[context.getRowId(row)], 'yayaw-list-dragging': dragged === row, 'yayaw-list-target': target === row && dragged !== row }"
          :data-yayaw-row-id="context.getRowId(row)"
          :data-row-id="context.getRowId(row)"
        >
          <div
            class="yayaw-list-item"
            tabindex="0"
            role="button"
            @click.capture="captureSelection(row, $event)"
            @mousedown.capture="(event) => { if (event.shiftKey || event.ctrlKey || event.metaKey) event.preventDefault(); }"
            @click="activate(row, $event)"
            @keydown="onKeydown(row, $event)"
          >
            <button
              v-if="canReorderRow(row)"
              type="button"
              class="yayaw-list-handle"
              :aria-label="reorderHint"
              :title="reorderHint"
              @click.stop
              @pointerdown="startDrag(row, $event)"
              @pointermove="trackDrag"
              @pointerup="endDrag"
              @pointercancel="cancelDrag"
            >
              <GripVertical :size="16" aria-hidden="true" />
            </button>
            <span
              v-if="context.config.table.enableRowSelection"
              class="yayaw-list-select"
              @click.capture="checkboxShift = $event.shiftKey"
              @click.stop
            >
              <TableCheckbox
                :label="`${translate('selectRow', 'Select')} ${titleText(row)}`"
                :model-value="Boolean(context.selection.value[context.getRowId(row)])"
                :disabled="!selectable(row)"
                @update:model-value="toggleSelection(row, $event, checkboxShift); checkboxShift = false"
              />
            </span>
            <strong class="yayaw-list-title" :class="{ 'yayaw-list-wrap': wrap, 'yayaw-list-title-start': propertyAlign === 'start' }">{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong>
            <dl class="yayaw-list-properties" :data-align="propertyAlign">
              <div v-for="id in properties" :key="id">
                <dt :class="{ 'yayaw-sr-only': !showLabels }">{{ column(id)?.header ?? id }}</dt>
                <dd><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd>
              </div>
            </dl>
            <RowActions v-if="showActions" :row="row" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
