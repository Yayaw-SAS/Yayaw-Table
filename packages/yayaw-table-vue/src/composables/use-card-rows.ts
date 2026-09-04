import { computed } from "vue";
import { useTableContext } from "../context";
import { applyTableQuery } from "../core";

/** Cards and the grid use the same page state; server pages must never be sliced twice. */
export const useCardRows = () => {
  const context = useTableContext();
  return computed(() => {
    if (context.data.isServer.value) {
      return context.data.rows.value;
    }
    const rows = applyTableQuery(context.data.rows.value, {
      columns: context.config.columns.definitions,
      search: context.state.search.value,
      filters: context.state.filters.value,
      advancedFilters: context.state.advancedFilters.value,
      sorting: context.state.sorting.value,
    });
    if (!context.config.table.enablePagination) {
      return rows;
    }
    const { pageIndex, pageSize } = context.state.pagination.value;
    return rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  });
};
