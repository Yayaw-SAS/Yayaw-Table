"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { facetsOpenAtom } from "../atoms/table-atoms";
import { translateWithFallback } from "../components/filters/i18n-utils";
import { useTableActions, useTranslations } from "../providers/table-provider";
import type { AdvancedFiltersState } from "../types/filter-types";
import {
  canToggleFacet,
  clearFacets,
  type FacetColumn,
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
} from "../utils/facets-model";
import { toFiltersParam } from "../utils/filtered-rows";
import { folderFacetLabel, folderTreeOf } from "../utils/folder-directory";
import type { ScopedRowsRequest } from "../utils/scoped-rows";
import { useFolderDirectory } from "./use-folder-directory";
import { useTableConfig } from "./use-table-config";
import { useTableUrlState } from "./use-table-url-state";

/**
 * The table's facets (`table.facets`), whether the current mode shows them
 * and whether the panel is open on wide screens (local to the instance,
 * starting from `defaultOpen`).
 */
export function useTableFacets({
  tableId,
  tableType,
}: {
  tableId: string;
  tableType: string;
}) {
  const { config } = useTableConfig(tableType);
  const { locale, t } = useTranslations();
  const state = useTableUrlState({
    defaultDisplayMode: config.table.defaultDisplayMode,
    enabled: config.table.syncUrl !== false,
    tableId,
  });
  const definitions = config.columns.definitions;
  const filetree = config.table.filetree;
  const tree = useMemo(
    () => folderTreeOf(filetree, definitions),
    [definitions, filetree]
  );
  const facets = useMemo(
    () =>
      resolveFacets(config.table.facets, definitions, {
        folderColumn: tree?.parentColumn,
        locale,
      }),
    [config.table.facets, definitions, locale, tree?.parentColumn]
  );
  const translate = useCallback(
    (key: string, fallback: string) =>
      translateWithFallback(t, `facets.${key}`, fallback),
    [t]
  );
  const label = useCallback(
    (key: FacetLabelKey, params?: Record<string, number | string>) =>
      facetLabel(key, locale, translate, params),
    [locale, translate]
  );
  const [override, setOpen] = useAtom(facetsOpenAtom(tableId));
  const shown =
    Boolean(facets) &&
    config.table.showToolbar !== false &&
    config.table.enableColumnFilters !== false &&
    facetsShownIn(state.displayModeParam);
  return {
    facets,
    label,
    locale,
    open: override ?? facets?.defaultOpen ?? true,
    selectedCount: facets
      ? selectedFacetCount(state.advancedFiltersParam, facets.columns)
      : 0,
    setOpen,
    shown,
    state,
    translate,
  };
}

/**
 * The facet panel's data: each facet's values with their counts (asked when
 * the panel shows, again after the table's data changes) and the clicks,
 * written to the view's advanced filters like the filter menus' rules.
 */
export function useFacetPanel({
  tableId,
  tableType,
}: {
  tableId: string;
  tableType: string;
}) {
  const base = useTableFacets({ tableId, tableType });
  const { facets, locale, state, translate } = base;
  const { t } = useTranslations();
  const getTableActions = useTableActions();
  const actions = getTableActions?.(tableType);
  const advancedFilters = state.advancedFiltersParam;
  const params = useMemo(
    () => ({
      search: state.globalSearchParam.trim(),
      filters: toFiltersParam(state.filtersParam),
      advancedFilters,
    }),
    [advancedFilters, state.filtersParam, state.globalSearchParam]
  );
  const countKey = useMemo(
    () =>
      JSON.stringify(
        facets?.columns.map((facet) => facetCountParams(params, facet)) ?? []
      ),
    [facets, params]
  );
  const counts = useQuery({
    enabled: Boolean(facets),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      loadFacetCounts({
        facets: facets?.columns ?? [],
        params,
        aggregate: actions?.aggregate as
          | ((input: Record<string, unknown>) => unknown)
          | undefined,
        list: actions?.list as ScopedRowsRequest["list"] | undefined,
        locale,
        signal,
      }),
    queryKey: ["tableData", tableId, "facets", countKey],
  });
  const hasFolders = Boolean(
    facets?.columns.some((facet) => facet.kind === "folder")
  );
  const folders = useFolderDirectory({
    enabled: hasFolders,
    tableId,
    tableType,
  });
  const folderTranslate = useCallback(
    (key: string, fallback: string) =>
      translateWithFallback(t, `filetree.${key}`, fallback),
    [t]
  );
  const { setAdvancedFiltersParam, setPageParam } = state;
  const write = useCallback(
    (next: FacetFilters) => {
      const now = new Date();
      setAdvancedFiltersParam(
        next.filters.map((filter) => ({
          createdAt: now,
          updatedAt: now,
          ...filter,
        })) as unknown as AdvancedFiltersState
      );
      setPageParam("0");
    },
    [setAdvancedFiltersParam, setPageParam]
  );
  const entriesOf = useCallback(
    (facet: FacetColumn) =>
      facetEntries(facet, {
        counts: counts.data?.[facet.id],
        selection: facetSelection(advancedFilters, facet),
        locale,
        showZero: facets?.showZero,
        translate,
        folderLabel: (id) =>
          folderFacetLabel(folders.directory, id, locale, folderTranslate),
      }),
    [
      advancedFilters,
      counts.data,
      facets?.showZero,
      folderTranslate,
      folders.directory,
      locale,
      translate,
    ]
  );
  const truncated = Object.values(counts.data ?? {}).some(
    (item) => item.truncated
  );
  return {
    ...base,
    entriesOf,
    loading: counts.isLoading || (hasFolders && folders.loading),
    error: counts.error,
    retry: counts.refetch,
    truncated,
    blocked: (facet: FacetColumn) => !canToggleFacet(advancedFilters, facet),
    selection: (facet: FacetColumn) => facetSelection(advancedFilters, facet),
    toggle: (facet: FacetColumn, value: unknown) =>
      write(toggleFacetValue(advancedFilters, facet, value)),
    clear: (facet: FacetColumn) => write(clearFacets(advancedFilters, [facet])),
    clearAll: () => write(clearFacets(advancedFilters, facets?.columns ?? [])),
  };
}
