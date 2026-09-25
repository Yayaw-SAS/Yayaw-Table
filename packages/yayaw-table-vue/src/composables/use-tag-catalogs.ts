import type { QueryClient } from "@tanstack/vue-query";
import {
  type ComputedRef,
  computed,
  onScopeDispose,
  reactive,
  shallowReactive,
} from "vue";
import {
  callTagAction,
  catalogAfterMerge,
  catalogAfterRemove,
  catalogAfterUpdate,
  catalogWithTag,
  createTag,
  mergeTagValue,
  type ResolvedTagColumn,
  removeTagValue,
  resolveTagLabels,
  type TableTag,
  type TableTagActions,
  type TableTagScope,
  type TagLabels,
  tagCatalogQuery,
  tagCatalogQueryKey,
  tagColumnForField,
  tagColumnsOf,
  tagUsageCounts,
  tagUsageRequest,
  withTagCatalogOptions,
} from "../tag-catalog";
import type {
  ColumnDefinition,
  TableActions,
  TableConfig,
  TableRecord,
} from "../types";

export type TagCatalogStatus = "error" | "loading" | "ready";

/** What tag pickers, bulk actions and "Manage tags" use from the table's catalogs. */
export interface TagCatalogRuntime {
  tableId: string;
  tableType: string;
  labels: ComputedRef<TagLabels>;
  /** The tags columns of the table. */
  columns: ResolvedTagColumn[];
  column: (columnId: string) => ResolvedTagColumn | undefined;
  /** The tags column a form field edits (by the record field it writes). */
  columnForField: (field: string) => ResolvedTagColumn | undefined;
  /** The column's catalog; empty while it loads. */
  tags: (columnId: string) => TableTag[];
  status: (columnId: string) => TagCatalogStatus;
  error: (columnId: string) => string | undefined;
  reload: (columnId: string) => Promise<void>;
  /** Whether the column shows colored tags (`coloredTags`, column then table). */
  coloredTags: (columnId: string) => boolean;
  columnLabel: (columnId: string) => string;
  canCreate: (columnId: string) => boolean;
  canManage: (columnId: string) => boolean;
  canUpdate: (columnId: string) => boolean;
  canMerge: (columnId: string) => boolean;
  canRemove: (columnId: string) => boolean;
  /** Whether "Manage tags" can count records per tag (`actions.aggregate`). */
  canCount: () => boolean;
  create: (columnId: string, name: string, color?: string) => Promise<TableTag>;
  update: (
    columnId: string,
    id: string,
    changes: { name?: string; color?: string | null }
  ) => Promise<void>;
  merge: (
    columnId: string,
    sourceIds: string[],
    targetId: string
  ) => Promise<void>;
  remove: (columnId: string, id: string) => Promise<void>;
  /** Records per tag id, from `actions.aggregate`; undefined without it. */
  usage: (columnId: string) => Promise<Record<string, number> | undefined>;
}

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Loads the catalogs of a table's tags columns (Vue Query, cached per table
 * and column) and puts them in the columns' `options`: `definitions` becomes
 * a shallow reactive array whose tags columns are replaced as their catalogs
 * load or change. Undefined without tags columns or `actions.tags.list`.
 */
export function useTagCatalogs<TData extends TableRecord>(input: {
  config: TableConfig<TData>;
  actions: ComputedRef<TableActions<TData> | undefined>;
  queryClient: QueryClient;
  tableId: string;
  tableType: string;
  locale: string;
  translate: (key: string) => string | undefined;
  /** The loaded rows, patched at once by merges and deletions. */
  rows: () => TableRecord[];
  /** Loads the rows again after a merge or a deletion. */
  refresh: () => Promise<void>;
}): TagCatalogRuntime | undefined {
  const source = input.config.columns.definitions;
  const columns = tagColumnsOf(source);
  const initialActions = input.actions.value?.tags;
  if (!(columns.length && initialActions?.list)) {
    return;
  }
  const tagActions = (): TableTagActions | undefined =>
    input.actions.value?.tags;
  // Tags columns are swapped for copies with the catalog's options.
  const definitions = shallowReactive([...source]);
  input.config.columns.definitions = definitions;
  const base = new Map(
    source.map((column) => [column.id, column as ColumnDefinition<TData>])
  );
  const catalogs = shallowReactive<Record<string, TableTag[] | undefined>>({});
  const statuses = reactive<Record<string, TagCatalogStatus>>({});
  const errors = reactive<Record<string, string | undefined>>({});
  const byId = new Map(columns.map((column) => [column.columnId, column]));
  const scopeOf = (columnId: string): TableTagScope => ({
    tableId: input.tableId,
    tableType: input.tableType,
    columnId,
  });
  const keyOf = (columnId: string) =>
    JSON.stringify(tagCatalogQueryKey(scopeOf(columnId)));

  const setCatalog = (columnId: string, tags: TableTag[]) => {
    catalogs[columnId] = tags;
    const index = definitions.findIndex((column) => column.id === columnId);
    const original = base.get(columnId);
    if (index >= 0 && original) {
      const [next] = withTagCatalogOptions([original], { [columnId]: tags });
      if (next) {
        definitions.splice(index, 1, next);
      }
    }
  };
  const writeCatalog = (columnId: string, tags: TableTag[]) => {
    input.queryClient.setQueryData(tagCatalogQueryKey(scopeOf(columnId)), tags);
    setCatalog(columnId, tags);
  };
  const load = async (columnId: string, force = false): Promise<void> => {
    const actions = tagActions();
    if (!actions?.list) {
      return;
    }
    if (!catalogs[columnId]) {
      statuses[columnId] = "loading";
    }
    try {
      const query = tagCatalogQuery(actions, scopeOf(columnId));
      const tags = await input.queryClient.fetchQuery(
        force ? { ...query, staleTime: 0 } : query
      );
      setCatalog(columnId, tags);
      statuses[columnId] = "ready";
      errors[columnId] = undefined;
    } catch (cause) {
      statuses[columnId] = "error";
      errors[columnId] = errorText(cause);
    }
  };
  for (const column of columns) {
    load(column.columnId).catch(() => undefined);
  }
  // Another instance sharing the query client keeps this one current.
  const unsubscribe = input.queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") {
      return;
    }
    const key = JSON.stringify(event.query.queryKey);
    const column = columns.find((item) => keyOf(item.columnId) === key);
    const data = event.query.state.data as TableTag[] | undefined;
    if (column && Array.isArray(data) && data !== catalogs[column.columnId]) {
      setCatalog(column.columnId, data);
    }
  });
  onScopeDispose(unsubscribe);

  const readCatalog = (columnId: string): TableTag[] =>
    catalogs[columnId] ?? [];
  const requireColumn = (columnId: string): ResolvedTagColumn => {
    const column = byId.get(columnId);
    if (!column) {
      throw new Error(`"${columnId}" is not a tags column.`);
    }
    return column;
  };
  /** Rewrites the tags field of the loaded rows; returns what restores them. */
  const patchRows = (field: string, map: (value: unknown) => unknown) => {
    const previous = new Map<TableRecord, unknown>();
    for (const row of input.rows()) {
      const next = map(row[field]);
      if (next !== row[field]) {
        previous.set(row, row[field]);
        row[field] = next;
      }
    }
    return () => {
      for (const [row, value] of previous) {
        row[field] = value;
      }
    };
  };
  const canManageColumn = (columnId: string) =>
    input.config.table.canManageTags !== false &&
    byId.get(columnId)?.manage === true;
  const labels = computed(() =>
    resolveTagLabels(input.locale, input.translate)
  );

  return {
    tableId: input.tableId,
    tableType: input.tableType,
    labels,
    columns,
    column: (columnId) => byId.get(columnId),
    columnForField: (field) => tagColumnForField(columns, field),
    tags: readCatalog,
    status: (columnId) => statuses[columnId] ?? "loading",
    error: (columnId) => errors[columnId],
    reload: (columnId) => load(columnId, true),
    coloredTags: (columnId) =>
      (base.get(columnId)?.coloredTags ?? input.config.table.coloredTags) !==
      false,
    columnLabel: (columnId) => base.get(columnId)?.header ?? columnId,
    canCreate: (columnId) =>
      Boolean(tagActions()?.create) && byId.get(columnId)?.create === true,
    canUpdate: (columnId) =>
      canManageColumn(columnId) && Boolean(tagActions()?.update),
    canMerge: (columnId) =>
      canManageColumn(columnId) && Boolean(tagActions()?.merge),
    canRemove: (columnId) =>
      canManageColumn(columnId) && Boolean(tagActions()?.remove),
    canManage: (columnId) => {
      const actions = tagActions();
      return (
        canManageColumn(columnId) &&
        Boolean(actions?.update || actions?.merge || actions?.remove)
      );
    },
    canCount: () => typeof input.actions.value?.aggregate === "function",
    create: async (columnId, name, color) => {
      requireColumn(columnId);
      const { tag } = await createTag({
        actions: tagActions() ?? {},
        scope: scopeOf(columnId),
        tags: readCatalog(columnId),
        name,
        color,
      });
      writeCatalog(columnId, catalogWithTag(readCatalog(columnId), tag));
      load(columnId, true).catch(() => undefined);
      return tag;
    },
    update: async (columnId, id, changes) => {
      requireColumn(columnId);
      const update = tagActions()?.update;
      if (!update) {
        throw new Error("Tags cannot be edited here.");
      }
      const previous = readCatalog(columnId);
      writeCatalog(columnId, catalogAfterUpdate(previous, id, changes));
      try {
        await callTagAction(
          () => update({ ...scopeOf(columnId), id, ...changes }),
          "The tag could not be saved."
        );
      } catch (cause) {
        writeCatalog(columnId, previous);
        throw cause;
      }
      await load(columnId, true);
    },
    merge: async (columnId, sourceIds, targetId) => {
      const column = requireColumn(columnId);
      const merge = tagActions()?.merge;
      if (!merge) {
        throw new Error("Tags cannot be merged here.");
      }
      const previous = readCatalog(columnId);
      writeCatalog(columnId, catalogAfterMerge(previous, sourceIds, targetId));
      const restoreRows = patchRows(column.field, (value) =>
        mergeTagValue(value, sourceIds, targetId)
      );
      try {
        await callTagAction(
          () =>
            merge({
              ...scopeOf(columnId),
              sourceIds: [...sourceIds],
              targetId,
            }),
          "The tags could not be merged."
        );
      } catch (cause) {
        writeCatalog(columnId, previous);
        restoreRows();
        throw cause;
      }
      await Promise.all([load(columnId, true), input.refresh()]);
    },
    remove: async (columnId, id) => {
      const column = requireColumn(columnId);
      const remove = tagActions()?.remove;
      if (!remove) {
        throw new Error("Tags cannot be deleted here.");
      }
      const previous = readCatalog(columnId);
      writeCatalog(columnId, catalogAfterRemove(previous, id));
      const restoreRows = patchRows(column.field, (value) =>
        removeTagValue(value, id)
      );
      try {
        await callTagAction(
          () => remove({ ...scopeOf(columnId), id }),
          "The tag could not be deleted."
        );
      } catch (cause) {
        writeCatalog(columnId, previous);
        restoreRows();
        throw cause;
      }
      await Promise.all([load(columnId, true), input.refresh()]);
    },
    usage: async (columnId) => {
      const aggregate = input.actions.value?.aggregate;
      if (!aggregate) {
        return;
      }
      return tagUsageCounts(
        await aggregate(
          tagUsageRequest(columnId, input.locale) as unknown as Parameters<
            typeof aggregate
          >[0]
        )
      );
    },
  };
}
