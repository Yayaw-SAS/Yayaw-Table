<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { createServerKanban, type ServerKanbanSource, type ServerKanbanState } from "../../server-kanban";
import { useTableContext } from "../../context";
import CellRenderer from "../table/CellRenderer.vue";
const props = defineProps<{ source: ServerKanbanSource; titleColumn: string; propertyIds: string[] }>();
const context = useTableContext();
const state = shallowRef<ServerKanbanState>({ lanes: [], loading: true });
let session: ReturnType<typeof createServerKanban> | undefined;
watch(() => props.source.queryKey, () => { session?.dispose(); session = createServerKanban(props.source, value => { state.value = value; }); void session.load(); }, { immediate: true });
onBeforeUnmount(() => session?.dispose());
const column = (id: string) => context.config.columns.definitions.find(item => item.id === id) ?? { id, header: id };
const value = (row: Record<string, unknown>, id: string) => column(id).accessorFn?.(row) ?? row[column(id).accessorKey ?? id];
const label = (key: "loading" | "retry" | "loadMore" | "empty", fallback: string) => props.source.labels?.[key] ?? fallback;
</script>
<template>
 <div>
 <p v-if="state.loading" role="status">{{ label('loading', 'Loading…') }}</p>
 <div v-if="state.error" role="alert">{{ state.error }}<button class="yayaw-button" type="button" @click="session?.load()">{{ label('retry', 'Retry') }}</button></div>
 <p v-if="!state.loading && !state.error && !state.lanes.length">{{ label('empty', 'No results') }}</p>
 <div class="yayaw-card-view-shell"><div class="yayaw-kanban">
 <section v-for="lane in state.lanes" :key="lane.value" class="yayaw-kanban-lane" :aria-label="lane.label">
 <header><strong>{{ lane.label }}</strong><span class="yayaw-count">{{ lane.totalCount }}</span></header>
 <div class="yayaw-kanban-cards">
 <article v-for="row in lane.rows" :key="source.getRowId?.(row) ?? String(row.id)" class="yayaw-card yayaw-kanban-card">
 <button type="button" class="yayaw-button yayaw-button-ghost" :disabled="!source.onActivate" @click="source.onActivate?.(row)">{{ value(row, titleColumn) ?? row.id }}</button>
 <dl class="yayaw-card-properties labeled"><template v-for="id in propertyIds.filter(item => item !== titleColumn)" :key="id"><dt>{{ column(id).header }}</dt><dd><CellRenderer :column="column(id)" :row="row" :value="value(row, id)" /></dd></template></dl>
 </article>
 <p v-if="lane.loading" role="status">{{ label('loading', 'Loading…') }}</p><p v-if="lane.error" role="alert">{{ lane.error }}</p>
 <button v-if="!lane.loading && (lane.error || lane.nextCursor !== null)" type="button" class="yayaw-button" @click="session?.loadLane(lane.value)">{{ lane.error ? label('retry', 'Retry') : label('loadMore', 'Load more') }}</button>
 <p v-if="!lane.loading && !lane.error && lane.totalCount === 0">{{ label('empty', 'No results') }}</p>
 </div></section></div></div></div>
</template>
