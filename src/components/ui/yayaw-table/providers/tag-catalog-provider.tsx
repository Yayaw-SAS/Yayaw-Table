"use client";

import { type QueryClient, useQueries } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo } from "react";
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
} from "../utils/tag-catalog";

export type TagCatalogStatus = "error" | "loading" | "ready";

/** What tag pickers, bulk actions and "Manage tags" use from the table's catalogs. */
export interface TagCatalogApi {
  tableId: string;
  tableType: string;
  labels: TagLabels;
  /** The tags columns of the table. */
  columns: ResolvedTagColumn[];
  column: (columnId: string) => ResolvedTagColumn | undefined;
  /** The tags column a form field edits (by the record field it writes). */
  columnForField: (field: string) => ResolvedTagColumn | undefined;
  /** The column's catalog; empty while it loads. */
  tags: (columnId: string) => TableTag[];
  /** Whether the column shows colored tags (`coloredTags`, column then table). */
  coloredTags: (columnId: string) => boolean;
  /** The column's header, translated. */
  columnLabel: (columnId: string) => string;
  status: (columnId: string) => TagCatalogStatus;
  error: (columnId: string) => string | undefined;
  reload: (columnId: string) => Promise<void>;
  canCreate: (columnId: string) => boolean;
  canManage: (columnId: string) => boolean;
  canUpdate: (columnId: string) => boolean;
  canMerge: (columnId: string) => boolean;
  canRemove: (columnId: string) => boolean;
  /** Whether "Manage tags" can count records per tag (`actions.aggregate`). */
  canCount: boolean;
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

const TagCatalogContext = createContext<TagCatalogApi | undefined>(undefined);

export const TagCatalogProvider = TagCatalogContext.Provider;

/** The table's tag catalogs, when a column has `tags` and the host `actions.tags`. */
export function useTagCatalog(): TagCatalogApi | undefined {
  return useContext(TagCatalogContext);
}

interface TableDataPayload {
  data?: unknown[];
  [key: string]: unknown;
}

interface ConfigLike {
  columns?: { definitions?: unknown[] };
  table?: { canManageTags?: boolean; coloredTags?: boolean };
  canManageTags?: boolean;
  coloredTags?: boolean;
}

interface ActionsLike {
  tags?: TableTagActions;
  aggregate?: (params: never) => Promise<unknown>;
}

interface CombinedCatalogs {
  data: (TableTag[] | undefined)[];
  status: TagCatalogStatus[];
  error: (string | undefined)[];
}

const combineCatalogs = (
  results: {
    data: TableTag[] | undefined;
    error: Error | null;
    isError: boolean;
    isPending: boolean;
  }[]
): CombinedCatalogs => ({
  data: results.map((result) => result.data),
  status: results.map((result) => {
    if (result.isError) {
      return "error";
    }
    return result.isPending ? "loading" : "ready";
  }),
  error: results.map((result) => result.error?.message),
});

const definitionsOf = (config: unknown): unknown[] | undefined =>
  (config as ConfigLike | undefined)?.columns?.definitions;

/** A config whose tags columns read their options from the loaded catalogs. */
function withCatalogs<T>(
  config: T,
  catalogs: Record<string, TableTag[] | undefined>
): T {
  const definitions = definitionsOf(config);
  if (!definitions) {
    return config;
  }
  const next = withTagCatalogOptions(
    definitions as { id: string }[],
    catalogs
  );
  if (next === definitions) {
    return config;
  }
  const source = config as ConfigLike;
  return {
    ...config,
    columns: { ...source.columns, definitions: next },
  } as T;
}

/**
 * Loads the catalogs of a table's tags columns (TanStack Query, cached per
 * table and column) and gives the table a `getTableConfig` whose tags columns
 * take their options from them, plus the API pickers and dialogs use.
 */
export function useTagCatalogRuntime<TConfig>({
  getTableActions,
  getTableConfig,
  locale,
  queryClient,
  tableId,
  tableType,
  translate,
}: {
  getTableActions?: (type: string) => unknown;
  getTableConfig?: (type: string) => TConfig | undefined;
  locale: string;
  queryClient: QueryClient;
  tableId: string;
  tableType: string;
  translate?: (key: string) => string;
}): {
  api: TagCatalogApi | undefined;
  getTableConfig?: (type: string) => TConfig | undefined;
} {
  const source = useMemo(
    () => getTableConfig?.(tableType),
    [getTableConfig, tableType]
  );
  const definitions = definitionsOf(source);
  const columns = useMemo(
    () =>
      tagColumnsOf(
        definitions as Parameters<typeof tagColumnsOf>[0] | undefined
      ),
    [definitions]
  );
  const allActions = useMemo(
    () => getTableActions?.(tableType) as ActionsLike | undefined,
    [getTableActions, tableType]
  );
  const actions = allActions?.tags;
  const hasCatalogs = Boolean(columns.length && actions?.list);
  const scopeOf = useCallback(
    (columnId: string): TableTagScope => ({ tableId, tableType, columnId }),
    [tableId, tableType]
  );
  const combined = useQueries(
    {
      queries: hasCatalogs
        ? columns.map((column) =>
            tagCatalogQuery(
              actions as TableTagActions,
              scopeOf(column.columnId)
            )
          )
        : [],
      combine: combineCatalogs,
    },
    queryClient
  );
  const catalogs = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column, index) => [
          column.columnId,
          combined.data[index],
        ])
      ) as Record<string, TableTag[] | undefined>,
    [columns, combined]
  );
  const loaded = Object.values(catalogs).some(Boolean);

  const tagAwareGetTableConfig = useMemo(() => {
    if (!(getTableConfig && hasCatalogs && loaded)) {
      return getTableConfig;
    }
    const cache = new WeakMap<object, TConfig>();
    return (type: string): TConfig | undefined => {
      const config = getTableConfig(type);
      if (
        !config ||
        typeof config !== "object" ||
        (type !== tableType && type !== tableId)
      ) {
        return config;
      }
      const cached = cache.get(config);
      if (cached) {
        return cached;
      }
      const next = withCatalogs(config, catalogs);
      cache.set(config, next);
      return next;
    };
  }, [catalogs, getTableConfig, hasCatalogs, loaded, tableId, tableType]);

  const sourceConfig = source as ConfigLike | undefined;
  const canManageTags =
    sourceConfig?.table?.canManageTags ?? sourceConfig?.canManageTags;
  const tableColoredTags =
    sourceConfig?.table?.coloredTags ?? sourceConfig?.coloredTags;
  const labels = useMemo(
    () => resolveTagLabels(locale, translate),
    [locale, translate]
  );

  const api = useMemo((): TagCatalogApi | undefined => {
    if (!(hasCatalogs && actions)) {
      return;
    }
    const byId = new Map(columns.map((column) => [column.columnId, column]));
    const keyOf = (columnId: string) =>
      tagCatalogQueryKey(scopeOf(columnId));
    const readCatalog = (columnId: string): TableTag[] =>
      queryClient.getQueryData<TableTag[]>(keyOf(columnId)) ??
      catalogs[columnId] ??
      [];
    const writeCatalog = (columnId: string, tags: TableTag[]) => {
      queryClient.setQueryData(keyOf(columnId), tags);
    };
    const refreshCatalog = async (columnId: string) => {
      await queryClient.invalidateQueries({ queryKey: keyOf(columnId) });
    };
    /** Rewrites the tags field of every cached row; returns what to restore. */
    const patchRows = (field: string, map: (value: unknown) => unknown) => {
      const snapshots = queryClient.getQueriesData<TableDataPayload>({
        queryKey: ["tableData", tableId],
      });
      for (const [key, payload] of snapshots) {
        if (!Array.isArray(payload?.data)) {
          continue;
        }
        let changed = false;
        const data = payload.data.map((row) => {
          const record = row as Record<string, unknown>;
          const next = map(record[field]);
          if (next === record[field]) {
            return row;
          }
          changed = true;
          return { ...record, [field]: next };
        });
        if (changed) {
          queryClient.setQueryData(key, { ...payload, data });
        }
      }
      return () => {
        for (const [key, payload] of snapshots) {
          queryClient.setQueryData(key, payload);
        }
      };
    };
    const refreshRows = async () => {
      await queryClient.invalidateQueries({ queryKey: ["tableData", tableId] });
      await queryClient.invalidateQueries({
        queryKey: ["tableColumnCalculations"],
      });
    };
    const requireColumn = (columnId: string): ResolvedTagColumn => {
      const column = byId.get(columnId);
      if (!column) {
        throw new Error(`"${columnId}" is not a tags column.`);
      }
      return column;
    };
    const canManageColumn = (columnId: string) =>
      canManageTags !== false && byId.get(columnId)?.manage === true;
    return {
      tableId,
      tableType,
      labels,
      columns,
      column: (columnId) => byId.get(columnId),
      columnForField: (field) => tagColumnForField(columns, field),
      tags: (columnId) => catalogs[columnId] ?? [],
      columnLabel: (columnId) => {
        const header = (
          definitions as { id?: string; header?: unknown }[] | undefined
        )?.find((column) => column.id === columnId)?.header;
        if (typeof header !== "string" || !header) {
          return columnId;
        }
        return translate?.(header) ?? header;
      },
      coloredTags: (columnId) => {
        const definition = (definitions as { id?: string; coloredTags?: boolean }[] | undefined)?.find(
          (column) => column.id === columnId
        );
        return (definition?.coloredTags ?? tableColoredTags) !== false;
      },
      status: (columnId) =>
        combined.status[columns.findIndex((c) => c.columnId === columnId)] ??
        "ready",
      error: (columnId) =>
        combined.error[columns.findIndex((c) => c.columnId === columnId)],
      reload: refreshCatalog,
      canCreate: (columnId) =>
        Boolean(actions.create) && byId.get(columnId)?.create === true,
      canUpdate: (columnId) =>
        canManageColumn(columnId) && Boolean(actions.update),
      canMerge: (columnId) =>
        canManageColumn(columnId) && Boolean(actions.merge),
      canRemove: (columnId) =>
        canManageColumn(columnId) && Boolean(actions.remove),
      canManage: (columnId) =>
        canManageColumn(columnId) &&
        Boolean(actions.update || actions.merge || actions.remove),
      canCount: typeof allActions?.aggregate === "function",
      create: async (columnId, name, color) => {
        requireColumn(columnId);
        const { tag } = await createTag({
          actions,
          scope: scopeOf(columnId),
          tags: readCatalog(columnId),
          name,
          color,
        });
        writeCatalog(columnId, catalogWithTag(readCatalog(columnId), tag));
        refreshCatalog(columnId).catch(() => undefined);
        return tag;
      },
      update: async (columnId, id, changes) => {
        requireColumn(columnId);
        const update = actions.update;
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
        await refreshCatalog(columnId);
      },
      merge: async (columnId, sourceIds, targetId) => {
        const column = requireColumn(columnId);
        const merge = actions.merge;
        if (!merge) {
          throw new Error("Tags cannot be merged here.");
        }
        const previous = readCatalog(columnId);
        writeCatalog(
          columnId,
          catalogAfterMerge(previous, sourceIds, targetId)
        );
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
        await Promise.all([refreshCatalog(columnId), refreshRows()]);
      },
      remove: async (columnId, id) => {
        const column = requireColumn(columnId);
        const remove = actions.remove;
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
        await Promise.all([refreshCatalog(columnId), refreshRows()]);
      },
      usage: async (columnId) => {
        const aggregate = allActions?.aggregate as
          | ((params: Record<string, unknown>) => Promise<unknown>)
          | undefined;
        if (!aggregate) {
          return;
        }
        return tagUsageCounts(
          await aggregate(tagUsageRequest(columnId, locale))
        );
      },
    };
  }, [
    actions,
    allActions,
    canManageTags,
    catalogs,
    columns,
    combined,
    definitions,
    hasCatalogs,
    labels,
    tableColoredTags,
    locale,
    queryClient,
    scopeOf,
    tableId,
    tableType,
    translate,
  ]);

  return { api, getTableConfig: tagAwareGetTableConfig };
}
