"use client";

import { type MouseEvent, type ReactNode, useMemo, useRef } from "react";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { TableActions } from "../providers/table-provider";
import type { Row } from "../tanstack";
import type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
} from "../types/display-mode-renderer";
import type { TableDisplayMode } from "../types/display-types";
import {
  GENERIC_MODE_CONFIG_KEYS,
  type GenericModeConfigKey,
  modeDefaultsOf,
} from "../utils/display-modes";
import {
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
} from "../utils/filtered-rows";
import type { FormLinkActions, FormSubmitResult } from "../utils/form-view";
import { getPrimaryGrouping } from "../utils/table-view-state";
import { translateWithFallback } from "./filters/i18n-utils";

type RowRecord = Record<string, unknown>;

const EMPTY_SETTINGS: RowRecord = {};

export interface DisplayModeRenderInput {
  mode: TableDisplayMode;
  tableId: string;
  tableType: string;
  locale: string;
  t: (key: string) => string;
  columns: TableCatalogueColumnConfig[];
  tableDefaults: object;
  modeConfigs: object;
  setModeConfig: (key: GenericModeConfigKey, value: object | undefined) => void;
  query: {
    advancedFilters: unknown;
    filters: unknown;
    search: string;
    sort: unknown;
  };
  /** The view's grouping (column ids). */
  grouping?: unknown;
  list?: TableActions["list"];
  aggregate?: TableActions["aggregate"];
  showRecords: (rules: RowRecord[]) => boolean;
  rows: RowRecord[];
  getRowId?: (row: RowRecord) => string;
  canEditRow: (row: RowRecord) => boolean;
  canCreate: boolean;
  editRow: (row: RowRecord, patch: RowRecord) => Promise<boolean>;
  activateRow: (row: Row<RowRecord>, event: MouseEvent) => void;
  createRow: (initial: RowRecord) => void;
  createRecord: (values: RowRecord) => Promise<FormSubmitResult>;
  viewId: string | null;
  formLinks?: FormLinkActions;
  emptyState: ReactNode;
}

const defaultRowId = (row: RowRecord) => String(row.id ?? row._id ?? "");

/** The context an optional renderer sees; stable while its inputs are. */
export function useDisplayModeRenderContext(
  input: DisplayModeRenderInput
): DisplayModeRenderContext {
  const {
    activateRow,
    canCreate,
    canEditRow,
    columns,
    createRecord,
    createRow,
    editRow,
    emptyState,
    formLinks,
    getRowId,
    grouping,
    list,
    aggregate,
    showRecords,
    locale,
    mode,
    modeConfigs,
    query,
    rows,
    setModeConfig,
    t,
    tableDefaults,
    tableId,
    tableType,
    viewId,
  } = input;
  // Page data changes after any mutation or form submit; renderers reload with it.
  const revisionCounter = useRef(0);
  const revision = useMemo(() => {
    revisionCounter.current += rows ? 1 : 0;
    return revisionCounter.current;
  }, [rows]);
  const configKey = GENERIC_MODE_CONFIG_KEYS.find((key) => key === mode);
  const settings =
    (configKey &&
      ((modeConfigs as RowRecord)[configKey] as RowRecord | undefined)) ||
    EMPTY_SETTINGS;
  const { advancedFilters, filters, search, sort } = query;
  const groupBy = getPrimaryGrouping(grouping) || undefined;
  const listParams = useMemo(
    () => ({
      advancedFilters: toAdvancedFiltersParam(advancedFilters),
      filters: toFiltersParam(filters),
      orderBy: toOrderByParam(sort),
      search: search || undefined,
    }),
    [advancedFilters, filters, search, sort]
  );

  return useMemo<DisplayModeRenderContext>(
    () => ({
      tableId,
      tableType,
      locale,
      columns,
      defaults: modeDefaultsOf(tableDefaults, mode),
      settings,
      updateSettings: (next) => {
        if (configKey) {
          setModeConfig(configKey, next);
        }
      },
      translate: (key, fallback) => translateWithFallback(t, key, fallback),
      listParams,
      list,
      aggregate,
      rows,
      advancedFilters,
      groupBy,
      showRecords,
      getRowId: getRowId ?? defaultRowId,
      canEditRow,
      canCreate,
      updateRow: editRow,
      openRow: (row, event) => {
        const id = (getRowId ?? defaultRowId)(row);
        activateRow(
          { id, original: row } as Row<RowRecord>,
          (event ?? { target: null }) as MouseEvent
        );
      },
      createRow,
      createRecord,
      viewId,
      formLinks,
      coloredTags: (tableDefaults as RowRecord).coloredTags !== false,
      revision,
      emptyState,
    }),
    [
      activateRow,
      advancedFilters,
      aggregate,
      canCreate,
      canEditRow,
      columns,
      configKey,
      createRecord,
      createRow,
      editRow,
      emptyState,
      formLinks,
      getRowId,
      groupBy,
      list,
      listParams,
      locale,
      mode,
      revision,
      rows,
      setModeConfig,
      settings,
      showRecords,
      t,
      tableDefaults,
      tableId,
      tableType,
      viewId,
    ]
  );
}

export function DisplayModeRendererView({
  context,
  renderer,
}: {
  context: DisplayModeRenderContext;
  renderer: DisplayModeRenderer;
}) {
  const { View } = renderer;
  return <View context={context} />;
}
