<script setup lang="ts">
import ServerKanbanView from "./ServerKanbanView.vue";
import { canMoveKanbanRows, isKanbanDragControl, kanbanMovePatch } from "../../kanban-move";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-vue-next";
import TableEmptyState from "../table/TableEmptyState.vue";
import { computed, ref } from "vue";
import { useKanbanSettings } from "../../composables/use-kanban-settings";
import { displayCellValue, imageSource } from "../../core";
import type { ColumnDefinition, TableRecord } from "../../types";
import { useCardRows } from "../../composables/use-card-rows";
import TableCheckbox from "../controls/TableCheckbox.vue";
import CellRenderer from "../table/CellRenderer.vue";
import { isBlankCardValue } from "../../value-format";
import { emptyGroupLabel, fieldText, groupValueKey } from "../../table-contracts";
import RowActions from "../table/RowActions.vue";
import InitialsAvatar from "../controls/InitialsAvatar.vue";
import { resolveAvatarConfig } from "../../initials-avatar";
import {
  arrangeKanbanLanes,
  kanbanLaneSettings,
  mergeKanbanLanes,
} from "../../kanban-lanes";

const { context, translate, titleColumn, propertyIds, showLabels, groupBy } = useKanbanSettings();
const dragged = ref<TableRecord>();
const pending = ref<string>();
const rows = useCardRows();
// Lane titles read the grouped value as the table shows it; `value` stays raw.
const laneLabel = (raw: unknown, fallback: string): string =>
  (fallback && fieldText(raw, column(groupBy.value), context.locale)) ||
  fallback ||
  emptyGroupLabel(context.locale);
const rawGroups = computed(() => {
  const configured = groupBy.value === context.config.table.kanban?.groupBy ? context.config.table.kanban?.groups ?? [] : [];
  const values = new Map<string, unknown>();
  for (const row of rows.value) {
    const raw = value(row, groupBy.value);
    const key = groupValueKey(raw);
    if (!values.has(key)) {
      values.set(key, raw);
    }
  }
  const groups = configured.map((group) => ({
    value: group.value,
    label: group.label ?? laneLabel(group.value, group.value),
  }));
  for (const [key, raw] of values) {
    if (!groups.some((group) => group.value === key)) {
      groups.push({ value: key, label: laneLabel(raw, key) });
    }
  }
  return groups;
});
// A view's lanes replace the default's column by column; hidden lanes hide their cards.
const lanes = computed(() =>
  arrangeKanbanLanes(
    rawGroups.value,
    kanbanLaneSettings(
      mergeKanbanLanes(
        context.config.table.kanban?.lanes,
        context.state.kanban.value.lanes
      ),
      groupBy.value
    )
  )
);
const groups = computed(() => lanes.value.visible);
const avatarConfig = computed(() =>
  resolveAvatarConfig(
    context.state.kanban.value.avatar ?? context.config.table.kanban?.avatar
  )
);
/** The avatar's name as the table shows it, like the title. */
const avatarName = (row: TableRecord): string => {
  const id = avatarConfig.value?.nameColumn ?? titleColumn.value;
  return fieldText(value(row, id), column(id), context.locale, row);
};
const avatarSource = (row: TableRecord): string | undefined =>
  avatarConfig.value?.imageColumn
    ? imageSource(value(row, avatarConfig.value.imageColumn))
    : undefined;
/** The card's title as read aloud: option labels, number and date formats. */
const titleText = (row: TableRecord): string =>
  fieldText(value(row, titleColumn.value), column(titleColumn.value), context.locale, row);
const rowsFor = (group: string): TableRecord[] =>
  rows.value.filter(
    (row) => groupValueKey(value(row, groupBy.value)) === group
  );
const column = (id: string): ColumnDefinition | undefined =>
  context.config.columns.definitions.find((item) => item.id === id);
const value = (row: TableRecord, id: string): unknown => {
  const definition = column(id);
  return definition?.accessorFn
    ? definition.accessorFn(row)
    : row[definition?.accessorKey ?? id];
};
const canDrag = computed(() => canMoveKanbanRows(context.config.table, column(groupBy.value), groupBy.value, Boolean(context.actions.value?.update)));
const canEditRow = (row: TableRecord): boolean =>
  context.config.table.canEditRow?.(row) !== false;
const canDragRow = (row: TableRecord): boolean =>
  Boolean(canDrag.value) && canEditRow(row);
const dragFromCard = computed(
  () => context.config.table.kanban?.dragFromCard === true
);
/** Row whose grip handle the current press started on. */
const pressedHandle = ref<string>();
const pressedControl = ref(false);
// A native drag moves the whole card, so without dragFromCard the card is
// draggable only when the press started on its handle.
const isDraggable = (row: TableRecord): boolean =>
  canDragRow(row) && !pressedControl.value &&
  (dragFromCard.value || pressedHandle.value === context.getRowId(row));
const press = (row: TableRecord, event: PointerEvent): void => {
  pressedControl.value = isKanbanDragControl(event.target);
  pressedHandle.value =
    event.target instanceof Element &&
    event.target.closest(".yayaw-kanban-drag-handle")
      ? context.getRowId(row)
      : undefined;
};
const startDrag = (row: TableRecord, event: DragEvent): void => {
  if (!isDraggable(row) || isKanbanDragControl(event.target)) { event.preventDefault(); return; }
  dragged.value = row;
};
const moveRow = async (
  row: TableRecord | undefined,
  target: string
): Promise<void> => {
  if (
    !canDrag.value || pending.value ||
    !(row && groupBy.value) ||
    String(value(row, groupBy.value)) === target ||
    !context.actions.value?.update ||
    context.config.table.canEditRow?.(row) === false
  ) {
    return;
  }
  const id = context.getRowId(row);
  pending.value = id;
  try {
    await writeRow(row, target);
    await context.refresh();
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    dragged.value = undefined;
    pending.value = undefined;
  }
};
const writeRow = async (row: TableRecord, target: string): Promise<void> => {
  const definition = column(groupBy.value);
  if (!canDragRow(row) || !definition || !context.actions.value?.update) throw new Error("Move not allowed");
  const result = await context.actions.value.update(context.config.table.kanban?.server?.getRowId?.(row) ?? context.getRowId(row), kanbanMovePatch(definition, groupBy.value, target), { row });
  if (!result.success) throw new Error(result.error ?? "Move failed");
};
const drop = async (target: string): Promise<void> => {
  await moveRow(dragged.value, target);
};
const adjacentGroup = (
  row: TableRecord,
  offset: -1 | 1
): { label: string; value: string } | undefined => {
  const currentValue = groupValueKey(value(row, groupBy.value));
  const currentIndex = groups.value.findIndex(
    (group) => group.value === currentValue
  );
  return currentIndex < 0 ? undefined : groups.value[currentIndex + offset];
};
const activate = (
  row: TableRecord,
  event: MouseEvent | KeyboardEvent
): void => {
  if (event instanceof KeyboardEvent && (event.target !== event.currentTarget || !["Enter", " "].includes(event.key))) {
    return;
  }
  if (event.target instanceof Element && event.target.closest("button,a,input,select,textarea,label")) return;
  if (event instanceof KeyboardEvent) event.preventDefault();
  context.activateRow(row, event as MouseEvent);
};
const toggleSelection = (row: TableRecord, checked: boolean): void => {
  if (context.config.table.canSelectRow?.(row) === false) {
    return;
  }
  if (!context.config.table.enableMultiRowSelection) {
    context.clearSelection();
  }
  context.selection.value[context.getRowId(row)] = checked;
};
</script>

<template>
  <ServerKanbanView v-if="context.config.table.kanban?.server" :source="context.config.table.kanban.server" :title-column="titleColumn" :property-ids="propertyIds" :group-by="groupBy" :can-move-row="canDragRow" :on-move-row="writeRow" :drag-from-card="dragFromCard" />
  <TableEmptyState
    v-else-if="!rows.length && !context.data.isLoading.value && !context.data.error.value && context.config.table.emptyState?.show !== false"
    class="yayaw-card-empty"
  />
  <div v-else class="yayaw-card-view-shell">

    <div class="yayaw-kanban" data-kanban-board="">
      <section v-for="group in groups" :key="group.value" class="yayaw-kanban-lane" :data-kanban-lane="group.value" @dragover.prevent @drop="drop(group.value)">
        <header><strong>{{ group.label }}</strong><span class="yayaw-count">{{ rowsFor(group.value).length }}</span></header>
        <div class="yayaw-kanban-cards">
          <article
            v-for="row in rowsFor(group.value)"
            :key="context.getRowId(row)"
            class="yayaw-card yayaw-kanban-card"
            :class="{ pending: pending === context.getRowId(row), 'drag-from-card': dragFromCard && canDragRow(row) }"
            :data-row-id="context.getRowId(row)"
            :draggable="isDraggable(row)"
            tabindex="0"
            @pointerdown="press(row, $event)"
            @dragstart="startDrag(row, $event)"
            @click="activate(row, $event)"
            @keydown="activate(row, $event)"
          >
            <div class="yayaw-card-header">
              <span v-if="context.config.table.enableRowSelection" class="yayaw-card-select" @click.stop>
                <TableCheckbox :label="translate('selectRow', 'Select') + ' ' + titleText(row)" :model-value="Boolean(context.selection.value[context.getRowId(row)])" :disabled="context.config.table.canSelectRow?.(row) === false" @update:model-value="toggleSelection(row, $event)" />
              </span>
              <InitialsAvatar v-if="avatarConfig" class="yayaw-card-avatar" decorative :name="avatarName(row)" :source="avatarSource(row)" :shape="avatarConfig.shape" />
              <strong>{{ displayCellValue(value(row, titleColumn), column(titleColumn) ?? { id: titleColumn, header: titleColumn }, context.locale) }}</strong>
              <div v-if="canDragRow(row)" class="yayaw-kanban-move-actions">
                <button
                  v-if="adjacentGroup(row, -1)"
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="translate('moveTo', 'Move') + ' ' + titleText(row) + ' ' + translate('to', 'to') + ' ' + adjacentGroup(row, -1)?.label"
                  :disabled="Boolean(pending)"
                  @click.stop="moveRow(row, adjacentGroup(row, -1)?.value ?? '')"
                >
                  <ArrowLeft :size="16" aria-hidden="true" />
                </button>
                <button
                  v-if="adjacentGroup(row, 1)"
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="translate('moveTo', 'Move') + ' ' + titleText(row) + ' ' + translate('to', 'to') + ' ' + adjacentGroup(row, 1)?.label"
                  :disabled="Boolean(pending)"
                  @click.stop="moveRow(row, adjacentGroup(row, 1)?.value ?? '')"
                >
                  <ArrowRight :size="16" aria-hidden="true" />
                </button>
              </div>
              <RowActions :row="row" />
              <!-- Pointer-only affordance: the move buttons are the keyboard path. -->
              <span v-if="canDragRow(row)" class="yayaw-kanban-drag-handle" aria-hidden="true" @click.stop>
                <GripVertical :size="16" />
              </span>
            </div>
            <dl class="yayaw-card-properties" :class="{ labeled: showLabels }">
              <template v-for="id in propertyIds.filter((item) => item !== titleColumn && item !== groupBy && (showLabels || !isBlankCardValue(value(row, item))))" :key="id">
                <dt v-if="showLabels">{{ column(id)?.header ?? id }}</dt>
                <dd :data-type="column(id)?.type"><CellRenderer :value="value(row, id)" :row="row" :column="column(id) ?? { id, header: id }" /></dd>
              </template>
            </dl>
          </article>
        </div>
      </section>
    </div>
    <p v-if="lanes.hidden.length" class="yayaw-kanban-hidden-lanes" data-kanban-hidden-lanes="">{{ translate('kanbanHiddenLanes', 'Hidden lanes') }}: {{ lanes.hidden.map((lane) => lane.label).join(', ') }}</p>
  </div>
</template>
