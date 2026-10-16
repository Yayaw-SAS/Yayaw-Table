"use client";

import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import {
  filterMenuAdvancedAtom,
  filterMenuAdvancedOpenAtom,
  filterMenuDraftsAtom,
  filterMenuJoinAtom,
  filterMenuMountedAtom,
  filterMenuOpenIdAtom,
  filterMenuPeriodOpenAtom,
} from "../atoms/table-atoms";
import { useTranslations } from "../providers/table-provider";
import type {
  AdvancedFilterModel,
  AdvancedFiltersState,
  ColumnsFilterConfig,
  FolderFilterConfig,
} from "../types/filter-types";
import { normalizeDateFilterRule } from "../utils/date-filter-days";
import { filterBarColumns } from "../utils/filter-bar";
import {
  defaultFilterOperator,
  type FilterMenuColumn,
  type FilterMenuTranslate,
  type FilterMenuType,
  filterMenuText,
  filterRuleComplete,
} from "../utils/filter-menu";
import {
  dataTypeFilter,
  normalizeFilterEnvelope,
} from "../utils/table-contracts";
import { useTableConfig } from "./use-table-config";
import { useTableUrlState } from "./use-table-url-state";

/** A column as the filter menu offers it. */
export interface FilterMenuColumnDef extends FilterMenuColumn {
  /** The file tree's parent column filters with a folder picker. */
  folder?: FolderFilterConfig;
}

/**
 * The filter menu's state beside the table's filters: rules still being
 * written (they show as chips but never reach the query or a saved view),
 * the chip whose editor is open, and whether the rules show as one advanced
 * filter. The view settings' Filter screen, column menus, the chips and the
 * date periods share it through the table's atoms.
 */
export interface FilterMenu {
  /** Columns the menu offers, in the table's order. */
  columns: FilterMenuColumnDef[];
  column: (id: string) => FilterMenuColumnDef | undefined;
  /** Every rule: the table's, then the incomplete ones being written. */
  rules: AdvancedFilterModel[];
  joinOperator: "and" | "or";
  /** Rules that filter: the table's active ones, without the incomplete. */
  activeCount: number;
  /** Date columns whose period stays in the filter bar or the toolbar. */
  pinnedDates: string[];
  openId: string | undefined;
  setOpenId: (id: string | undefined) => void;
  advanced: boolean;
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  periodOpen: string | undefined;
  setPeriodOpen: (columnId: string | undefined) => void;
  /**
   * Adds a rule for a column (the first by default) and opens its editor:
   * its chip's, or the advanced filter's when the rules show that way.
   * `open: false` adds it without opening anything. A pinned date column has
   * one period: its editor opens instead.
   */
  add: (columnId?: string, open?: boolean) => void;
  /** Saves an edited rule: a complete one filters, an incomplete one waits. */
  update: (rule: AdvancedFilterModel) => void;
  remove: (id: string) => void;
  setJoin: (joinOperator: "and" | "or") => void;
  /** Shows the rules as the advanced filter, with a new rule when there is none. */
  openAdvanced: () => void;
  /** Removes every rule but the `keep` ones, the incomplete ones too. */
  clear: (keep?: readonly string[]) => void;
  tableId: string;
  tableType: string;
  locale: string;
  translate: FilterMenuTranslate;
  text: (key: Parameters<typeof filterMenuText>[0]) => string;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const EXCLUDED = new Set(["actions", "select"]);

export function useFilterMenu({
  tableId,
  tableType,
  columnsConfig,
}: {
  tableId: string;
  tableType: string;
  /** The toolbar's filter configuration: folder pickers and options. */
  columnsConfig?: ColumnsFilterConfig;
}): FilterMenu {
  const { config } = useTableConfig(tableType);
  const { t, locale } = useTranslations();
  const url = useTableUrlState({
    tableId,
    enabled: config.table.syncUrl !== false,
  });
  const [drafts, setDrafts] = useAtom(filterMenuDraftsAtom(tableId));
  const [openId, setOpenId] = useAtom(filterMenuOpenIdAtom(tableId));
  const [advanced, setAdvanced] = useAtom(filterMenuAdvancedAtom(tableId));
  const [advancedOpen, setAdvancedOpen] = useAtom(
    filterMenuAdvancedOpenAtom(tableId)
  );
  const [joinDraft, setJoinDraft] = useAtom(filterMenuJoinAtom(tableId));
  const [periodOpen, setPeriodOpen] = useAtom(
    filterMenuPeriodOpenAtom(tableId)
  );
  const translate = useCallback<FilterMenuTranslate>(
    (key) => {
      const value = t(key);
      return value === key ? undefined : value;
    },
    [t]
  );
  const columns = useMemo<FilterMenuColumnDef[]>(
    () =>
      config.columns.definitions
        .filter(
          (column) =>
            column.enableFiltering !== false &&
            column.type !== "actions" &&
            !EXCLUDED.has(column.id)
        )
        .map((column) => {
          const folder = columnsConfig?.[column.id]?.folder;
          const columnOptions = column.options as FilterMenuColumn["options"];
          const type = folder
            ? "select"
            : (dataTypeFilter(
                column.type,
                Boolean(columnOptions?.length)
              ) as FilterMenuType);
          const options =
            column.type === "boolean" && !columnOptions?.length
              ? [
                  {
                    value: true,
                    label: filterMenuText("checked", locale, translate),
                  },
                  {
                    value: false,
                    label: filterMenuText("unchecked", locale, translate),
                  },
                ]
              : columnOptions;
          return {
            id: column.id,
            header: column.header ?? column.id,
            type,
            options,
            folder,
          };
        }),
    [columnsConfig, config.columns.definitions, locale, translate]
  );
  const envelope = normalizeFilterEnvelope(url.advancedFiltersParam);
  const saved = envelope.filters as unknown as AdvancedFilterModel[];
  // The rules carry "or"; without a complete rule the choice waits here.
  const joinOperator = saved.length ? envelope.joinOperator : joinDraft;
  const rules = useMemo(() => [...saved, ...drafts], [saved, drafts]);
  const pinnedDates = useMemo(
    () => [
      ...new Set([
        ...filterBarColumns(
          config.columns.definitions,
          config.table.filterBarColumns
        )
          .filter((column) => column.type === "date")
          .map((column) => column.id),
        ...(config.table.toolbarDateFilter
          ? [config.table.toolbarDateFilter]
          : []),
      ]),
    ],
    [
      config.columns.definitions,
      config.table.filterBarColumns,
      config.table.toolbarDateFilter,
    ]
  );
  const write = (filters: AdvancedFilterModel[], join = joinOperator) => {
    url.setAdvancedFiltersParam(
      filters.map(({ joinOperator: _join, ...filter }) =>
        join === "or" ? { ...filter, joinOperator: "or" } : filter
      ) as AdvancedFiltersState
    );
    url.setPageParam("0");
  };
  const column = (id: string) => columns.find((item) => item.id === id);
  const add = (columnId?: string, open = true) => {
    const target = columnId ? column(columnId) : columns[0];
    if (!target) {
      return;
    }
    if (
      open &&
      pinnedDates.includes(target.id) &&
      !advanced &&
      joinOperator !== "or"
    ) {
      setPeriodOpen(target.id);
      return;
    }
    const now = new Date();
    const rule = {
      id: newId(),
      columnId: target.id,
      type: target.type,
      operator: target.folder ? "isAnyOf" : defaultFilterOperator(target.type),
      values: undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as unknown as AdvancedFilterModel;
    setDrafts((current) => [...current, rule]);
    if (!open) {
      return;
    }
    if (advanced || joinOperator === "or") {
      setAdvancedOpen(true);
    } else {
      setOpenId(rule.id);
    }
  };
  const update = (edited: AdvancedFilterModel) => {
    // Date rules keep the calendar days they name, whatever an older link saved.
    const rule = {
      ...normalizeDateFilterRule(edited),
      updatedAt: new Date(),
    } as AdvancedFilterModel;
    const isSaved = saved.some((item) => item.id === rule.id);
    if (filterRuleComplete(rule)) {
      setDrafts((current) => current.filter((item) => item.id !== rule.id));
      write(
        isSaved
          ? saved.map((item) => (item.id === rule.id ? rule : item))
          : [...saved, rule]
      );
      return;
    }
    // An emptied rule stops filtering but stays on screen until removed.
    if (isSaved) {
      write(saved.filter((item) => item.id !== rule.id));
    }
    setDrafts((current) =>
      current.some((item) => item.id === rule.id)
        ? current.map((item) => (item.id === rule.id ? rule : item))
        : [...current, rule]
    );
  };
  const remove = (id: string) => {
    setDrafts((current) => current.filter((item) => item.id !== id));
    if (saved.some((item) => item.id === id)) {
      write(saved.filter((item) => item.id !== id));
    }
    if (openId === id) {
      setOpenId(undefined);
    }
    if (rules.length <= 1) {
      setAdvanced(false);
      setAdvancedOpen(false);
    }
  };
  const clear = (keep: readonly string[] = []) => {
    setDrafts((current) => current.filter((item) => keep.includes(item.id)));
    setJoinDraft("and");
    write(
      saved.filter((item) => keep.includes(item.id)),
      "and"
    );
    setAdvanced(false);
    setAdvancedOpen(false);
    setOpenId(undefined);
  };
  return {
    columns,
    column,
    rules,
    joinOperator,
    activeCount: saved.filter((rule) => rule.isActive !== false).length,
    pinnedDates,
    openId,
    setOpenId,
    advanced,
    advancedOpen,
    setAdvancedOpen,
    periodOpen,
    setPeriodOpen,
    add,
    update,
    remove,
    setJoin: (join) => {
      setJoinDraft(join);
      write(saved, join);
    },
    openAdvanced: () => {
      setAdvanced(true);
      setOpenId(undefined);
      if (!rules.length) {
        add(undefined, false);
      }
      setAdvancedOpen(true);
    },
    clear,
    tableId,
    tableType,
    locale,
    translate,
    text: (key) => filterMenuText(key, locale, translate),
  };
}

/** Counts a mounted filter menu, so column menus open their rule there. */
export function useFilterMenuMounted(tableId: string, enabled: boolean) {
  const setMounted = useSetAtom(filterMenuMountedAtom(tableId));
  useEffect(() => {
    if (!enabled) {
      return;
    }
    setMounted((count) => count + 1);
    return () => setMounted((count) => count - 1);
  }, [enabled, setMounted]);
}
