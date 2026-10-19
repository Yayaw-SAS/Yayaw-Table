<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { GripVertical } from "lucide-vue-next";
import InitialsAvatar from "../controls/InitialsAvatar.vue";
import { imageSource } from "../../core";
import { resolveAvatarConfig } from "../../initials-avatar";
import { arrangeKanbanLanes, kanbanLaneSettings, mergeKanbanLanes } from "../../kanban-lanes";
import { createServerKanban, type ServerKanbanSource, type ServerKanbanState } from "../../server-kanban";
import { useTableContext } from "../../context";
import CellRenderer from "../table/CellRenderer.vue";
import { isKanbanDragControl, kanbanKeyboardDirection } from "../../kanban-move";
import { fieldText } from "../../table-contracts";
const props = defineProps<{ source: ServerKanbanSource; titleColumn: string; propertyIds: string[]; groupBy?: string; canMoveRow?: (row: Record<string, unknown>) => boolean; onMoveRow?: (row: Record<string, unknown>, target: string) => Promise<void>; dragFromCard?: boolean }>();
const context = useTableContext();
const state = shallowRef<ServerKanbanState>({ lanes: [], loading: true });
let session: ReturnType<typeof createServerKanban> | undefined;
watch(() => props.source.queryKey, () => { session?.dispose(); session = createServerKanban(props.source, value => { state.value = value; }); if (typeof window !== "undefined") void session.load(); }, { immediate: true });
onBeforeUnmount(() => session?.dispose());
const column = (id: string) => context.config.columns.definitions.find(item => item.id === id) ?? { id, header: id };
const value = (row: Record<string, unknown>, id: string) => column(id).accessorFn?.(row) ?? row[column(id).accessorKey ?? id];
const label = (key: "loading" | "retry" | "loadMore" | "empty", fallback: string) => props.source.labels?.[key] ?? fallback;
// Lane order and hidden lanes of the grouping column, as on the local board.
const lanes = computed(() => arrangeKanbanLanes(state.value.lanes, kanbanLaneSettings(mergeKanbanLanes(context.config.table.kanban?.lanes, context.state.kanban.value.lanes), props.groupBy ?? "")));
const avatarConfig = computed(() => resolveAvatarConfig(context.state.kanban.value.avatar ?? context.config.table.kanban?.avatar));
const avatarName = (row: Record<string, unknown>) => { const id = avatarConfig.value?.nameColumn ?? props.titleColumn; return fieldText(value(row, id), column(id), context.locale, row); };
const avatarSource = (row: Record<string, unknown>) => avatarConfig.value?.imageColumn ? imageSource(value(row, avatarConfig.value.imageColumn)) : undefined;
const hiddenLabel = () => String(context.translations.value.kanbanHiddenLanes ?? "Hidden lanes");
const dragged = ref<string>();
const pressedHandle = ref<string>();
const pressedControl = ref(false);
const rowId = (row: Record<string, unknown>) => props.source.getRowId?.(row) ?? String(row.id);
const canMove = (row: Record<string, unknown>) => Boolean(props.onMoveRow && props.canMoveRow?.(row));
const busy = computed(() => Boolean(state.value.loading || state.value.moving || state.value.lanes.some(lane => lane.loading)));
const isDraggable = (row: Record<string, unknown>) => !busy.value && !pressedControl.value && canMove(row) && (props.dragFromCard || pressedHandle.value === rowId(row));
const press = (row: Record<string, unknown>, event: PointerEvent) => {
  pressedControl.value = isKanbanDragControl(event.target);
  pressedHandle.value = event.target instanceof Element && event.target.closest(".yayaw-kanban-drag-handle") ? rowId(row) : undefined;
};
const startDrag = (row: Record<string, unknown>, event: DragEvent) => {
  if (!isDraggable(row) || isKanbanDragControl(event.target)) { event.preventDefault(); return; }
  dragged.value = rowId(row);
};
const move = async (row: Record<string, unknown>, target: string) => {
  if (!canMove(row) || !props.onMoveRow) return;
  await session?.move(rowId(row), target, props.onMoveRow);
};
const drop = async (target: string) => {
  const row = state.value.lanes.flatMap(lane => lane.rows).find(item => rowId(item) === dragged.value);
  dragged.value = undefined;
  if (row) await move(row, target);
};
const keyboardMove = (row: Record<string, unknown>, laneIndex: number, event: KeyboardEvent) => {
  const direction = kanbanKeyboardDirection(event);
  const target = lanes.value.visible[laneIndex + direction];
  if (!direction || !target || !canMove(row) || busy.value) return;
  event.preventDefault();
  return move(row, target.value);
};

</script>
<template>
 <div>
 <p v-if="state.loading" role="status">{{ label('loading', 'Loading…') }}</p>
 <div v-if="state.error" role="alert">{{ state.error }}<button class="yayaw-button" type="button" @click="session?.load()">{{ label('retry', 'Retry') }}</button></div>
 <p v-if="!state.loading && !state.error && !state.lanes.length">{{ label('empty', 'No results') }}</p>
 <p v-if="state.moveError" role="alert">{{ state.moveError }}</p>
 <div class="yayaw-card-view-shell"><div class="yayaw-kanban" data-kanban-board="">
 <section v-for="(lane, laneIndex) in lanes.visible" :key="lane.value" class="yayaw-kanban-lane" :aria-label="lane.label" :data-kanban-lane="lane.value" @dragover.prevent @drop="drop(lane.value)">
 <header><strong>{{ lane.label }}</strong><span class="yayaw-count">{{ lane.totalCount }}</span></header>
 <div class="yayaw-kanban-cards">
 <article v-for="row in lane.rows" :key="rowId(row)" class="yayaw-card yayaw-kanban-card" :class="{ 'drag-from-card': dragFromCard && canMove(row) }" :data-row-id="rowId(row)" :tabindex="canMove(row) ? 0 : undefined" :aria-label="fieldText(value(row, titleColumn), column(titleColumn), context.locale, row)" :aria-keyshortcuts="canMove(row) ? 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight' : undefined" @keydown="keyboardMove(row, laneIndex, $event)" :draggable="isDraggable(row)" :aria-busy="state.moving === rowId(row) || undefined" @pointerdown="press(row, $event)" @dragstart="startDrag(row, $event)" @dragend="dragged = undefined; pressedHandle = undefined">
 <InitialsAvatar v-if="avatarConfig" class="yayaw-card-avatar" decorative :name="avatarName(row)" :source="avatarSource(row)" :shape="avatarConfig.shape" />
 <button type="button" class="yayaw-button yayaw-button-ghost" :disabled="!source.onActivate" @click="source.onActivate?.(row)">{{ fieldText(value(row, titleColumn), column(titleColumn), context.locale, row) || row.id }}</button>
 <span v-if="canMove(row) && !dragFromCard" class="yayaw-kanban-drag-handle" aria-hidden="true"><GripVertical :size="16" /></span>
 <dl class="yayaw-card-properties labeled"><template v-for="id in propertyIds.filter(item => item !== titleColumn)" :key="id"><dt>{{ column(id).header }}</dt><dd><CellRenderer :column="column(id)" :row="row" :value="value(row, id)" /></dd></template></dl>
 </article>
 <p v-if="lane.loading" role="status">{{ label('loading', 'Loading…') }}</p><p v-if="lane.error" role="alert">{{ lane.error }}</p>
 <button v-if="!lane.loading && (lane.error || lane.nextCursor !== null)" type="button" class="yayaw-button" @click="session?.loadLane(lane.value)">{{ lane.error ? label('retry', 'Retry') : label('loadMore', 'Load more') }}</button>
 <p v-if="!lane.loading && !lane.error && lane.totalCount === 0">{{ label('empty', 'No results') }}</p>
 </div></section></div></div>
 <p v-if="lanes.hidden.length" class="yayaw-kanban-hidden-lanes" data-kanban-hidden-lanes="">{{ hiddenLabel() }}: {{ lanes.hidden.map(lane => lane.label).join(', ') }}</p>
 </div>
</template>
