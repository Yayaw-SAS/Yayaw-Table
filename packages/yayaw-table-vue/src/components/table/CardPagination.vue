<script setup lang="ts">
import { computed, watch } from "vue";
import { useTableContext } from "../../context";

const context = useTableContext();
const pages = computed(() => Math.max(1, context.data.isServer.value
  ? context.data.pageCount.value
  : Math.ceil(context.matchingRowCount.value / context.state.pagination.value.pageSize)));
watch([pages, () => context.state.pagination.value.pageIndex, context.data.isLoading], ([count, , loading]) => {
  if (context.data.isServer.value && loading) return;
  if (context.state.pagination.value.pageIndex >= count) context.state.pagination.value = { ...context.state.pagination.value, pageIndex: count - 1 };
}, { immediate: true });
const move = (offset: number) => {
  context.state.pagination.value = { ...context.state.pagination.value,
    pageIndex: Math.min(pages.value - 1, Math.max(0, context.state.pagination.value.pageIndex + offset)) };
};
const resize = (event: Event) => {
  context.state.pagination.value = { pageIndex: 0, pageSize: Number((event.target as HTMLSelectElement).value) };
};
</script>

<template>
  <footer v-if="context.config.table.enablePagination" class="yayaw-pagination">
    <span>{{ context.matchingRowCount.value }}</span>
    <label>{{ context.translations.value.rowsPerPage }}
      <select class="yayaw-select" :value="context.state.pagination.value.pageSize" @change="resize">
        <option v-for="size in context.config.table.pageSizeOptions" :key="size" :value="size">{{ size }}</option>
      </select>
    </label>
    <span>{{ context.state.pagination.value.pageIndex + 1 }} / {{ pages }}</span>
    <button type="button" class="yayaw-button yayaw-button-outline" :disabled="context.state.pagination.value.pageIndex === 0" @click="move(-1)">{{ context.translations.value.previous }}</button>
    <button type="button" class="yayaw-button yayaw-button-outline" :disabled="context.state.pagination.value.pageIndex >= pages - 1" @click="move(1)">{{ context.translations.value.next }}</button>
  </footer>
</template>
