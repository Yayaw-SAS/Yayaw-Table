import { computed, type ComputedRef, type Ref, ref } from "vue";
import { normalizeDateFilterRule } from "../date-filter-days";
import { filterBarColumns } from "../filter-bar";
import { filterType } from "../filter-config";
import {
  defaultFilterOperator,
  type FilterMenuColumn,
  type FilterMenuType,
  filterRuleComplete,
} from "../filter-menu";
import { folderTableOptions } from "../folder-directory";
import type {
  AdvancedFilter,
  AdvancedFilterOperator,
  AdvancedFiltersState,
  ColumnDefinition,
  TableConfig,
} from "../types";

/**
 * The filter menu's state beside the table's filters: rules still being
 * written (they show as chips but never reach the query or a saved view),
 * the chip whose editor is open, and whether the rules show as one advanced
 * filter. The toolbar's Filter button, column menus and the chips share it.
 */
export interface FilterMenuStore {
  /** Columns the menu offers, in the table's order. */
  columns: ComputedRef<ColumnDefinition[]>;
  /** Every rule: the table's, then the incomplete ones being written. */
  rules: ComputedRef<AdvancedFilter[]>;
  /** The rule whose editor is open. */
  openId: Ref<string | undefined>;
  /** The advanced filter's editor is open. */
  advancedOpen: Ref<boolean>;
  /** The rules show as one advanced filter even while all must match. */
  advanced: Ref<boolean>;
  /** Date columns whose period stays in the filter bar or the toolbar. */
  pinnedDates: ComputedRef<string[]>;
  /** The pinned date column whose period editor is open. */
  periodOpen: Ref<string | undefined>;
  /**
   * Adds a rule for a column (the first by default) and opens its editor:
   * its chip's, or the advanced filter's when the rules show that way.
   * `open: false` adds it where it is asked, without opening anything.
   * A pinned date column has one period: its editor opens instead.
   */
  add: (columnId?: string, open?: boolean) => AdvancedFilter | undefined;
  /** Saves an edited rule: a complete one filters, an incomplete one waits. */
  update: (rule: AdvancedFilter) => void;
  remove: (id: string) => void;
  setJoin: (joinOperator: "and" | "or") => void;
  /** Shows the rules as the advanced filter, with a new rule when there is none. */
  openAdvanced: () => void;
  /** Removes every rule but the `keep` ones, the incomplete ones too. */
  clear: (keep?: readonly string[]) => void;
  clearDrafts: () => void;
  /** The column's type to the menu. */
  typeOf: (column: ColumnDefinition | undefined) => FilterMenuType;
  /** The file tree's parent column, filtered with a folder picker. */
  isFolderColumn: (column: ColumnDefinition | undefined) => boolean;
  menuColumn: (column: ColumnDefinition, labels: { yes: string; no: string }) => FilterMenuColumn;
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createFilterMenuStore({
  config,
  state,
  folderColumn,
}: {
  config: TableConfig;
  state: Ref<AdvancedFiltersState>;
  folderColumn: () => string | undefined;
}): FilterMenuStore {
  const drafts = ref<AdvancedFilter[]>([]);
  const openId = ref<string>();
  const advancedOpen = ref(false);
  const advanced = ref(false);
  const periodOpen = ref<string>();
  const pinnedDates = computed(() => [
    ...new Set([
      ...filterBarColumns(config.columns.definitions, config.table.filterBarColumns)
        .filter((column) => column.type === "date")
        .map((column) => column.id),
      ...(config.table.toolbarDateFilter ? [config.table.toolbarDateFilter] : []),
    ]),
  ]);
  const columns = computed(() =>
    config.columns.definitions.filter(
      (column) =>
        column.enableFiltering !== false &&
        column.type !== "actions" &&
        !["actions", "select"].includes(column.id)
    )
  );
  const isFolderColumn = (column: ColumnDefinition | undefined): boolean =>
    Boolean(column) &&
    column?.id === folderColumn() &&
    Boolean(folderTableOptions(config.table.filetree).folderFilter);
  const typeOf = (column: ColumnDefinition | undefined): FilterMenuType =>
    isFolderColumn(column) ? "select" : (filterType(column) as FilterMenuType);
  const rules = computed(() => [...state.value.filters, ...drafts.value]);
  const add = (columnId?: string, open = true): AdvancedFilter | undefined => {
    const column = columnId
      ? columns.value.find((item) => item.id === columnId)
      : columns.value[0];
    if (!column) return;
    if (open && pinnedDates.value.includes(column.id) && !advanced.value && state.value.joinOperator !== "or") {
      periodOpen.value = column.id;
      return;
    }
    const type = typeOf(column);
    const rule: AdvancedFilter = {
      id: newId(),
      columnId: column.id,
      type,
      operator: (isFolderColumn(column) ? "isAnyOf" : defaultFilterOperator(type)) as AdvancedFilterOperator,
      values: undefined,
      isActive: true,
    };
    drafts.value = [...drafts.value, rule];
    if (!open) return rule;
    if (advanced.value || state.value.joinOperator === "or") advancedOpen.value = true;
    else openId.value = rule.id;
    return rule;
  };
  const update = (edited: AdvancedFilter): void => {
    // Date rules keep the calendar days they name, whatever an older link saved.
    const rule = normalizeDateFilterRule(edited);
    const complete = filterRuleComplete(rule);
    const saved = state.value.filters.some((item) => item.id === rule.id);
    if (complete) {
      drafts.value = drafts.value.filter((item) => item.id !== rule.id);
      state.value = {
        ...state.value,
        filters: saved
          ? state.value.filters.map((item) => (item.id === rule.id ? rule : item))
          : [...state.value.filters, rule],
      };
      return;
    }
    // An emptied rule stops filtering but stays on screen until removed.
    if (saved) {
      state.value = { ...state.value, filters: state.value.filters.filter((item) => item.id !== rule.id) };
    }
    drafts.value = drafts.value.some((item) => item.id === rule.id)
      ? drafts.value.map((item) => (item.id === rule.id ? rule : item))
      : [...drafts.value, rule];
  };
  const remove = (id: string): void => {
    drafts.value = drafts.value.filter((item) => item.id !== id);
    if (state.value.filters.some((item) => item.id === id)) {
      state.value = { ...state.value, filters: state.value.filters.filter((item) => item.id !== id) };
    }
    if (openId.value === id) openId.value = undefined;
    if (!rules.value.length) {
      advanced.value = false;
      advancedOpen.value = false;
    }
  };
  const setJoin = (joinOperator: "and" | "or"): void => {
    state.value = { ...state.value, joinOperator };
  };
  const openAdvanced = (): void => {
    advanced.value = true;
    openId.value = undefined;
    if (!rules.value.length) add(undefined, false);
    advancedOpen.value = true;
  };
  const clear = (keep: readonly string[] = []): void => {
    drafts.value = drafts.value.filter((item) => keep.includes(item.id));
    state.value = {
      ...state.value,
      filters: state.value.filters.filter((item) => keep.includes(item.id)),
      joinOperator: "and",
    };
    advanced.value = false;
    advancedOpen.value = false;
    openId.value = undefined;
  };
  const menuColumn = (column: ColumnDefinition, labels: { yes: string; no: string }): FilterMenuColumn => ({
    id: column.id,
    header: column.header,
    type: typeOf(column),
    options:
      column.type === "boolean" && !column.options?.length
        ? [
            { value: true, label: labels.yes },
            { value: false, label: labels.no },
          ]
        : column.options,
  });
  return {
    columns,
    rules,
    openId,
    advancedOpen,
    advanced,
    pinnedDates,
    periodOpen,
    add,
    update,
    remove,
    setJoin,
    openAdvanced,
    clear,
    clearDrafts: () => {
      drafts.value = [];
    },
    typeOf,
    isFolderColumn,
    menuColumn,
  };
}
