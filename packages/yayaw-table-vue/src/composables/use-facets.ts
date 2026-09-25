import { computed, onScopeDispose, ref, watch } from "vue";
import { useTableContext } from "../context";
import { applyTableQuery } from "../core";
import {
  canToggleFacet,
  clearFacets,
  type FacetColumn,
  type FacetCounts,
  type FacetFilters,
  type FacetLabelKey,
  facetCountParams,
  facetEntries,
  facetLabel,
  facetSelection,
  facetsShownIn,
  loadFacetCounts,
  resolveFacets,
  selectedFacetCount,
  toggleFacetValue,
} from "../facets-model";
import { folderFacetLabel } from "../folder-directory";
import type { ScopedRowsRequest } from "../scoped-rows";
import { normalizeFilterEnvelope, recordValue } from "../table-contracts";
import type {
  AdvancedFilter,
  AdvancedFiltersState,
  ColumnFiltersState,
  TableRecord,
} from "../types";

/**
 * The table's facets (`table.facets`), whether the current mode shows them
 * and whether the panel is open on wide screens (local to the instance,
 * starting from `defaultOpen`).
 */
export function useFacets() {
  const context = useTableContext();
  const facets = computed(() =>
    resolveFacets(
      context.config.table.facets,
      context.config.columns.definitions,
      {
        folderColumn: context.folders.tree?.parentColumn,
        locale: context.locale,
      }
    )
  );
  const translate = (key: string, fallback: string): string => {
    const value = context.translations.value[`facets.${key}`];
    return typeof value === "string" ? value : fallback;
  };
  const label = (
    key: FacetLabelKey,
    params?: Record<string, number | string>
  ): string => facetLabel(key, context.locale, translate, params);
  const shown = computed(
    () =>
      Boolean(facets.value) &&
      context.config.table.showToolbar !== false &&
      context.config.table.enableColumnFilters !== false &&
      facetsShownIn(context.state.displayMode.value)
  );
  const open = computed({
    get: () => context.facetsOpen.value ?? facets.value?.defaultOpen ?? true,
    set: (value: boolean) => {
      context.facetsOpen.value = value;
    },
  });
  const selectedCount = computed(() =>
    facets.value
      ? selectedFacetCount(
          context.state.advancedFilters.value,
          facets.value.columns
        )
      : 0
  );
  return {
    facets,
    label,
    locale: context.locale,
    open,
    selectedCount,
    shown,
    translate,
  };
}

const errorOf = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/**
 * The facet panel's data: each facet's values with their counts (asked while
 * the panel shows, again after the table's data changes) and the clicks,
 * written to the view's advanced filters like the filter menus' rules.
 */
export function useFacetPanel() {
  const base = useFacets();
  const context = useTableContext();
  const counts = ref<Record<string, FacetCounts>>();
  const loading = ref(false);
  const error = ref<Error>();
  const params = computed(() => ({
    search: context.state.search.value.trim(),
    filters: Object.fromEntries(
      context.state.filters.value.map((filter) => [filter.id, filter.value])
    ),
    advancedFilters: context.state.advancedFilters.value,
  }));
  const key = computed(() =>
    JSON.stringify(
      base.facets.value?.columns.map((facet) =>
        facetCountParams(params.value, facet)
      ) ?? []
    )
  );
  // Tables without a list action count their own rows under each query.
  const filterRows = (
    rows: readonly unknown[],
    query: Record<string, unknown>
  ) => {
    const envelope = normalizeFilterEnvelope(query.advancedFilters);
    return applyTableQuery(rows as TableRecord[], {
      columns: context.config.columns.definitions,
      search: String(query.search ?? ""),
      filters: Object.entries(recordValue(query.filters)).map(
        ([id, value]) => ({
          id,
          value,
        })
      ) as ColumnFiltersState,
      advancedFilters: {
        filters: envelope.filters as unknown as AdvancedFilter[],
        joinOperator: envelope.joinOperator,
      },
    });
  };
  let controller: AbortController | undefined;
  const load = async (): Promise<void> => {
    const facets = base.facets.value;
    if (!facets) {
      return;
    }
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading.value = true;
    error.value = undefined;
    try {
      const actions = context.actions.value;
      const aggregate = actions?.aggregate;
      const list = actions?.list;
      const result = await loadFacetCounts({
        facets: facets.columns,
        params: params.value,
        aggregate: aggregate
          ? async (input) => await aggregate(input as never)
          : undefined,
        list: list
          ? ((async (input) =>
              await list(input as never)) as ScopedRowsRequest["list"])
          : undefined,
        rows: context.data.rows.value,
        filterRows,
        locale: context.locale,
        signal: current.signal,
      });
      if (!current.signal.aborted) {
        counts.value = result;
      }
    } catch (cause) {
      if (!current.signal.aborted) {
        error.value = errorOf(cause);
      }
    } finally {
      if (controller === current) {
        loading.value = false;
      }
    }
  };
  watch(
    [
      key,
      context.dataRevision,
      () => (context.data.isServer.value ? undefined : context.data.rows.value),
    ],
    () => {
      load().catch(() => undefined);
    },
    { immediate: true }
  );
  onScopeDispose(() => controller?.abort());
  const hasFolders = computed(() =>
    Boolean(base.facets.value?.columns.some((facet) => facet.kind === "folder"))
  );
  watch(
    hasFolders,
    (value) => {
      if (value) {
        context.folders.use();
      }
    },
    { immediate: true }
  );
  const folderTranslate = (key: string, fallback: string): string => {
    const value = context.translations.value[`filetree.${key}`];
    return typeof value === "string" ? value : fallback;
  };
  const write = (next: FacetFilters): void => {
    context.state.advancedFilters.value = {
      filters: next.filters as unknown as AdvancedFilter[],
      joinOperator: next.joinOperator,
    } as AdvancedFiltersState;
  };
  const advancedFilters = () => context.state.advancedFilters.value;
  const entriesOf = (facet: FacetColumn) =>
    facetEntries(facet, {
      counts: counts.value?.[facet.id],
      selection: facetSelection(advancedFilters(), facet),
      locale: context.locale,
      showZero: base.facets.value?.showZero,
      translate: base.translate,
      folderLabel: (id) =>
        folderFacetLabel(
          context.folders.directory.value,
          id,
          context.locale,
          folderTranslate
        ),
    });
  const truncated = computed(() =>
    Object.values(counts.value ?? {}).some((item) => item.truncated)
  );
  return {
    ...base,
    entriesOf,
    loading: computed(
      () => loading.value || (hasFolders.value && context.folders.loading.value)
    ),
    error,
    retry: () => load().catch(() => undefined),
    truncated,
    blocked: (facet: FacetColumn) => !canToggleFacet(advancedFilters(), facet),
    selection: (facet: FacetColumn) => facetSelection(advancedFilters(), facet),
    toggle: (facet: FacetColumn, value: unknown) =>
      write(toggleFacetValue(advancedFilters(), facet, value)),
    clear: (facet: FacetColumn) =>
      write(clearFacets(advancedFilters(), [facet])),
    clearAll: () =>
      write(clearFacets(advancedFilters(), base.facets.value?.columns ?? [])),
  };
}
