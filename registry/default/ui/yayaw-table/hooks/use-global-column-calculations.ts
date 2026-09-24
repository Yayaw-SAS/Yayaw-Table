"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { columnCalculationsAtom } from "../atoms/footer-atoms";
import type {
  TableActions,
  TableAggregateResultValue,
} from "../providers/table-provider";
import {
  useLocale,
  useTableActions as useProviderTableActions,
} from "../providers/table-provider";
import {
  type CalculationType,
  isCalculationValidForColumn,
} from "../types/footer-types";
import { calculateColumn } from "../utils/column-calculations";
import {
  fetchAllFilteredRows,
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
  toPageSize,
} from "../utils/filtered-rows";
import { normalizeFilterEnvelope } from "../utils/table-contracts";
import {
  type ColumnValueFormat,
  formatColumnCalculation,
} from "../utils/value-format";
import { useTableUrlState } from "./use-table-url-state";

/** A column as the footer reads it: its type, formats and accessor. */
interface ColumnCalculationDefinition extends ColumnValueFormat {
  id: string;
  type?: string;
  enableCalculation?: boolean;
  defaultCalculation?: string;
  accessorKey?: string;
  accessorFn?: (row: never) => unknown;
}

interface ResolvedCalculations {
  calculations: Record<string, CalculationType>;
  columnTypes: Record<string, string | undefined>;
}

/** Only what formats a result: the query key changes when a format does. */
const formatOf = (
  column: ColumnCalculationDefinition | undefined
): ColumnValueFormat | undefined =>
  column && {
    type: column.type,
    numberFormat: column.numberFormat,
    dateDisplayPreset: column.dateDisplayPreset,
    dateFormat: column.dateFormat,
    timeZone: column.timeZone,
    hour12: column.hour12,
  };

/**
 * A host's result keeps its own label; a plain value (or a result without a
 * label) reads in the column's format, as the list fallback does.
 */
const resultWithLabel = (
  value: unknown,
  calculation: CalculationType,
  column: ColumnValueFormat | undefined,
  locale: string
): TableAggregateResultValue => {
  const record =
    value && typeof value === "object"
      ? (value as Partial<TableAggregateResultValue>)
      : undefined;
  if (typeof record?.label === "string") {
    return record as TableAggregateResultValue;
  }
  const raw = (record ? record.raw : value) as number | string | null;
  return {
    raw: raw ?? null,
    label: formatColumnCalculation(raw, calculation, column, locale),
  };
};

const EMPTY_RESULTS: Record<string, TableAggregateResultValue> = {};
const isSystemColumnId = (columnId: string): boolean => {
  return columnId === "actions" || columnId === "select";
};

const resolveSelectedCalculation = ({
  columnId,
  columnType,
  defaultCalculation,
  userCalculations,
}: {
  columnId: string;
  columnType?: string;
  defaultCalculation?: CalculationType;
  userCalculations: Record<string, CalculationType>;
}): CalculationType | undefined => {
  const selected = userCalculations[columnId] ?? defaultCalculation ?? "none";

  if (!isCalculationValidForColumn(selected, columnType)) {
    return;
  }

  return selected;
};

const assignCalculationResult = ({
  calculations,
  columnId,
  columnType,
  columnTypes,
  selected,
}: {
  calculations: Record<string, CalculationType>;
  columnId: string;
  columnType?: string;
  columnTypes: Record<string, string | undefined>;
  selected: CalculationType;
}) => {
  if (selected === "none") {
    return;
  }

  calculations[columnId] = selected;
  columnTypes[columnId] = columnType;
};

const collectDefinitionCalculations = ({
  allowedIds,
  calculations,
  columnDefinitions,
  columnTypes,
  userCalculations,
}: {
  allowedIds?: Set<string>;
  calculations: Record<string, CalculationType>;
  columnDefinitions: ColumnCalculationDefinition[];
  columnTypes: Record<string, string | undefined>;
  userCalculations: Record<string, CalculationType>;
}): Set<string> => {
  const seenIds = new Set<string>();

  for (const definition of columnDefinitions) {
    const columnId = definition.id;
    if (!columnId || isSystemColumnId(columnId)) {
      continue;
    }
    if (allowedIds && !allowedIds.has(columnId)) {
      continue;
    }
    if (definition.enableCalculation === false) {
      continue;
    }

    const selected = resolveSelectedCalculation({
      columnId,
      columnType: definition.type,
      defaultCalculation: definition.defaultCalculation as
        | CalculationType
        | undefined,
      userCalculations,
    });
    if (!selected) {
      continue;
    }

    seenIds.add(columnId);
    assignCalculationResult({
      calculations,
      columnId,
      columnType: definition.type,
      columnTypes,
      selected,
    });
  }

  return seenIds;
};

const collectRemainingAllowedIdCalculations = ({
  allowedIds,
  calculations,
  columnTypes,
  seenIds,
  userCalculations,
}: {
  allowedIds: Set<string>;
  calculations: Record<string, CalculationType>;
  columnTypes: Record<string, string | undefined>;
  seenIds: Set<string>;
  userCalculations: Record<string, CalculationType>;
}) => {
  for (const columnId of allowedIds) {
    if (seenIds.has(columnId) || isSystemColumnId(columnId)) {
      continue;
    }

    const selected = resolveSelectedCalculation({
      columnId,
      userCalculations,
    });
    if (!selected) {
      continue;
    }

    assignCalculationResult({
      calculations,
      columnId,
      columnType: undefined,
      columnTypes,
      selected,
    });
  }
};

export const resolveActiveColumnCalculations = ({
  columnDefinitions,
  columnIds,
  userCalculations,
}: {
  columnDefinitions: ColumnCalculationDefinition[];
  columnIds?: string[];
  userCalculations: Record<string, CalculationType>;
}): ResolvedCalculations => {
  const calculations: Record<string, CalculationType> = {};
  const columnTypes: Record<string, string | undefined> = {};
  const allowedIds = columnIds ? new Set(columnIds) : undefined;

  const seenIds = collectDefinitionCalculations({
    allowedIds,
    calculations,
    columnDefinitions,
    columnTypes,
    userCalculations,
  });

  if (!allowedIds) {
    return { calculations, columnTypes };
  }

  collectRemainingAllowedIdCalculations({
    allowedIds,
    calculations,
    columnTypes,
    seenIds,
    userCalculations,
  });

  return { calculations, columnTypes };
};

export const useGlobalColumnCalculations = ({
  tableId,
  tableType,
  columnDefinitions,
  columnIds,
}: {
  tableId: string;
  tableType: string;
  columnDefinitions: ColumnCalculationDefinition[];
  columnIds?: string[];
}) => {
  const locale = useLocale();
  const userCalculations = useAtomValue(columnCalculationsAtom(tableId));
  const getTableActions = useProviderTableActions();
  const tableActions = useMemo(
    () => getTableActions?.(tableType),
    [getTableActions, tableType]
  );
  const {
    advancedFiltersParam,
    filtersParam,
    globalSearchParam,
    pageSizeParam,
    sortParam,
  } = useTableUrlState({ tableId });

  const { calculations, columnTypes } = useMemo(
    () =>
      resolveActiveColumnCalculations({
        columnDefinitions,
        columnIds,
        userCalculations,
      }),
    [columnDefinitions, columnIds, userCalculations]
  );

  const columnsById = useMemo(
    () =>
      Object.fromEntries(
        columnDefinitions
          .filter((definition) => definition.id in calculations)
          .map((definition) => [definition.id, definition])
      ),
    [calculations, columnDefinitions]
  );
  const calculationsKey = useMemo(
    () =>
      JSON.stringify([
        calculations,
        Object.values(columnsById).map((definition) => [
          definition.id,
          formatOf(definition),
        ]),
      ]),
    [calculations, columnsById]
  );

  const filtersKey = useMemo(
    () => JSON.stringify(filtersParam),
    [filtersParam]
  );
  const advancedFiltersKey = useMemo(
    () => JSON.stringify(advancedFiltersParam),
    [advancedFiltersParam]
  );

  const hasAnyCalculation = Object.keys(calculations).length > 0;
  const canFetchFromServer =
    typeof tableActions?.aggregate === "function" ||
    typeof tableActions?.list === "function";

  const query = useQuery({
    queryKey: [
      "tableColumnCalculations",
      tableId,
      tableType,
      locale,
      calculationsKey,
      filtersKey,
      advancedFiltersKey,
      globalSearchParam,
      sortParam,
      pageSizeParam,
    ],
    enabled: hasAnyCalculation && canFetchFromServer,
    queryFn: async (): Promise<Record<string, TableAggregateResultValue>> =>
      loadGlobalColumnCalculationResults({
        actions: tableActions,
        advancedFiltersParam,
        calculations,
        columns: columnsById,
        columnTypes,
        filtersParam,
        globalSearchParam,
        locale,
        pageSizeParam,
        sortParam,
      }),
    staleTime: 15_000,
  });

  return {
    activeCalculations: calculations,
    error: query.error,
    hasAnyCalculation,
    isLoading: query.isFetching,
    resultsByColumn: query.data ?? EMPTY_RESULTS,
  };
};

export const loadGlobalColumnCalculationResults = async ({
  actions,
  advancedFiltersParam,
  calculations,
  columns = {},
  columnTypes,
  filtersParam,
  globalSearchParam,
  locale,
  pageSizeParam,
  sortParam,
}: {
  actions: TableActions | undefined;
  advancedFiltersParam: unknown;
  calculations: Record<string, CalculationType>;
  /** Formats and accessors of the calculated columns, by id. */
  columns?: Record<string, ColumnCalculationDefinition>;
  columnTypes: Record<string, string | undefined>;
  filtersParam: unknown;
  globalSearchParam: string;
  locale: string;
  pageSizeParam: string;
  sortParam: unknown;
}): Promise<Record<string, TableAggregateResultValue>> => {
  const filters = toFiltersParam(filtersParam);
  const advancedFilters = toAdvancedFiltersParam(advancedFiltersParam);
  const search = globalSearchParam.trim();
  const orderBy = toOrderByParam(sortParam);

  if (typeof actions?.aggregate === "function") {
    try {
      const response = await actions.aggregate({
        filters,
        advancedFilters,
        advancedFilterJoin:
          normalizeFilterEnvelope(advancedFiltersParam).joinOperator,
        search,
        calculations,
        locale,
      });
      return Object.fromEntries(
        Object.entries(response.results ?? EMPTY_RESULTS).map(
          ([columnId, value]) => [
            columnId,
            resultWithLabel(
              value,
              calculations[columnId] ?? "none",
              formatOf(columns[columnId]) ?? { type: columnTypes[columnId] },
              locale
            ),
          ]
        )
      );
    } catch {
      // Fallback to list strategy below when aggregate fails.
    }
  }

  if (typeof actions?.list !== "function") {
    return EMPTY_RESULTS;
  }

  const rows = await fetchAllFilteredRows({
    listAction: actions.list,
    advancedFilters,
    filters,
    orderBy,
    pageSize: toPageSize(pageSizeParam),
    search,
  });

  const results: Record<string, TableAggregateResultValue> = {};
  for (const [columnId, calculationType] of Object.entries(calculations)) {
    const column = columns[columnId];
    // Read values as the cells do: the accessor first, then the id.
    const values = rows.map((row) => {
      if (column?.accessorFn) {
        return (column.accessorFn as (record: typeof row) => unknown)(row);
      }
      return row[column?.accessorKey ?? columnId];
    });
    results[columnId] = calculateColumn(
      values,
      calculationType,
      columnTypes[columnId],
      locale,
      formatOf(column)
    );
  }

  return results;
};
