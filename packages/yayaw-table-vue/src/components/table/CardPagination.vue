<script setup lang="ts">
import { computed, watch } from "vue";
import { useTableContext } from "../../context";
import TableSelect from "../controls/TableSelect.vue";

const context = useTableContext();
// As in React: more than one page by the server's page count or by the row count.
const pages = computed(() => {
  const byRows = Math.ceil(context.matchingRowCount.value / context.state.pagination.value.pageSize);
  return Math.max(1, context.data.isServer.value ? Math.max(context.data.pageCount.value, byRows) : byRows);
});
watch([pages, () => context.state.pagination.value.pageIndex, context.data.isLoading], ([count, , loading]) => {
  if (context.data.isServer.value && loading) return;
  if (context.state.pagination.value.pageIndex >= count) context.state.pagination.value = { ...context.state.pagination.value, pageIndex: count - 1 };
}, { immediate: true });
const move = (offset: number) => {
  context.state.pagination.value = { ...context.state.pagination.value,
    pageIndex: Math.min(pages.value - 1, Math.max(0, context.state.pagination.value.pageIndex + offset)) };
};
const pageSize = computed({
  get: () => context.state.pagination.value.pageSize,
  set: (value: number) => {
    context.state.pagination.value = { pageIndex: 0, pageSize: value };
  },
});
const sizeOptions = computed(() => [...new Set([pageSize.value, ...context.config.table.pageSizeOptions])].map((size) => ({ value: size, label: String(size) })));

</script>

<template>
  <footer v-if="context.config.table.enablePagination && pages > 1" class="yayaw-pagination">
    <span>{{ context.matchingRowCount.value }}</span>
    <TableSelect v-model="pageSize" :label="String(context.translations.value.rowsPerPage)" :options="sizeOptions" />
    <span>{{ context.state.pagination.value.pageIndex + 1 }} / {{ pages }}</span>
    <button type="button" class="yayaw-button yayaw-button-outline" :disabled="context.state.pagination.value.pageIndex === 0" @click="move(-1)">{{ context.translations.value.previous }}</button>
    <button type="button" class="yayaw-button yayaw-button-outline" :disabled="context.state.pagination.value.pageIndex >= pages - 1" @click="move(1)">{{ context.translations.value.next }}</button>
  </footer>
</template>
