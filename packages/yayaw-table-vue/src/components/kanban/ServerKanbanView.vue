<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import InitialsAvatar from "../controls/InitialsAvatar.vue";
import { imageSource } from "../../core";
import { resolveAvatarConfig } from "../../initials-avatar";
import { arrangeKanbanLanes, kanbanLaneSettings, mergeKanbanLanes } from "../../kanban-lanes";
import { createServerKanban, type ServerKanbanSource, type ServerKanbanState } from "../../server-kanban";
import { useTableContext } from "../../context";
import CellRenderer from "../table/CellRenderer.vue";
import { fieldText } from "../../table-contracts";
const props = defineProps<{ source: ServerKanbanSource; titleColumn: string; propertyIds: string[]; groupBy?: string }>();
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
</script>
<template>
 <div>
 <p v-if="state.loading" role="status">{{ label('loading', 'Loading…') }}</p>
 <div v-if="state.error" role="alert">{{ state.error }}<button class="yayaw-button" type="button" @click="session?.load()">{{ label('retry', 'Retry') }}</button></div>
 <p v-if="!state.loading && !state.error && !state.lanes.length">{{ label('empty', 'No results') }}</p>
 <div class="yayaw-card-view-shell"><div class="yayaw-kanban" data-kanban-board="">
 <section v-for="lane in lanes.visible" :key="lane.value" class="yayaw-kanban-lane" :aria-label="lane.label" :data-kanban-lane="lane.value">
 <header><strong>{{ lane.label }}</strong><span class="yayaw-count">{{ lane.totalCount }}</span></header>
 <div class="yayaw-kanban-cards">
 <article v-for="row in lane.rows" :key="source.getRowId?.(row) ?? String(row.id)" class="yayaw-card yayaw-kanban-card" :data-row-id="source.getRowId?.(row) ?? String(row.id)">
 <InitialsAvatar v-if="avatarConfig" class="yayaw-card-avatar" decorative :name="avatarName(row)" :source="avatarSource(row)" :shape="avatarConfig.shape" />
 <button type="button" class="yayaw-button yayaw-button-ghost" :disabled="!source.onActivate" @click="source.onActivate?.(row)">{{ fieldText(value(row, titleColumn), column(titleColumn), context.locale, row) || row.id }}</button>
 <dl class="yayaw-card-properties labeled"><template v-for="id in propertyIds.filter(item => item !== titleColumn)" :key="id"><dt>{{ column(id).header }}</dt><dd><CellRenderer :column="column(id)" :row="row" :value="value(row, id)" /></dd></template></dl>
 </article>
 <p v-if="lane.loading" role="status">{{ label('loading', 'Loading…') }}</p><p v-if="lane.error" role="alert">{{ lane.error }}</p>
 <button v-if="!lane.loading && (lane.error || lane.nextCursor !== null)" type="button" class="yayaw-button" @click="session?.loadLane(lane.value)">{{ lane.error ? label('retry', 'Retry') : label('loadMore', 'Load more') }}</button>
 <p v-if="!lane.loading && !lane.error && lane.totalCount === 0">{{ label('empty', 'No results') }}</p>
 </div></section></div></div>
 <p v-if="lanes.hidden.length" class="yayaw-kanban-hidden-lanes" data-kanban-hidden-lanes="">{{ hiddenLabel() }}: {{ lanes.hidden.map(lane => lane.label).join(', ') }}</p>
 </div>
</template>
