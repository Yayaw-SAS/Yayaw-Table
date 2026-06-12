import type {
  CreateTableViewInput,
  TableView,
  TableViewActionContext,
  TableViewActionResult,
  TableViewActions,
  UpdateTableViewInput,
} from "../types/view-types";
import { normalizeTableViewConfig } from "./table-view-state";

export const LOCAL_TABLE_VIEWS_STORAGE_PREFIX = "yayaw-table-views";

export interface TableViewStorageAdapter {
  getItem: (key: string) => null | string;
  setItem: (key: string, value: string) => void;
}

interface LocalTableViewActionsOptions {
  idFactory?: () => string;
  now?: () => Date;
  storage?: TableViewStorageAdapter;
}

const memoryStorageMap = new Map<string, string>();

const memoryStorage: TableViewStorageAdapter = {
  getItem: (key) => memoryStorageMap.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorageMap.set(key, value);
  },
};

function getBrowserStorage(): TableViewStorageAdapter | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    return window.localStorage;
  } catch {
    return;
  }
}

function resolveStorage(
  storage?: TableViewStorageAdapter
): TableViewStorageAdapter {
  return storage ?? getBrowserStorage() ?? memoryStorage;
}

export function getTableViewsStorageKey(tableId: string): string {
  return `${LOCAL_TABLE_VIEWS_STORAGE_PREFIX}:${tableId}`;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return;
}

function normalizeStoredView(rawView: unknown): TableView | undefined {
  if (!rawView || typeof rawView !== "object") {
    return;
  }

  const record = rawView as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.tableId !== "string" ||
    !record.config ||
    typeof record.config !== "object"
  ) {
    return;
  }

  return {
    config: normalizeTableViewConfig(record.config),
    createdAt: parseDate(record.createdAt),
    createdById:
      typeof record.createdById === "string" ? record.createdById : "local",
    id: record.id,
    isDefault: record.isDefault === true,
    isGlobal: record.isGlobal === true,
    isSystem: record.isSystem === true,
    name: record.name,
    ownerId:
      typeof record.ownerId === "string" || record.ownerId === null
        ? record.ownerId
        : undefined,
    tableId: record.tableId,
    updatedAt: parseDate(record.updatedAt),
  };
}

function readViews(
  storage: TableViewStorageAdapter,
  tableId: string
): TableView[] {
  const raw = storage.getItem(getTableViewsStorageKey(tableId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeStoredView)
      .filter((view): view is TableView => Boolean(view));
  } catch {
    return [];
  }
}

function writeViews(
  storage: TableViewStorageAdapter,
  tableId: string,
  views: TableView[]
): void {
  storage.setItem(getTableViewsStorageKey(tableId), JSON.stringify(views));
}

function normalizeDefaultViews(
  views: TableView[],
  defaultViewId: string | undefined
): TableView[] {
  if (!defaultViewId) {
    return views;
  }

  return views.map((view) => ({
    ...view,
    isDefault: view.id === defaultViewId,
  }));
}

function createSuccess<TData>(data: TData): TableViewActionResult<TData> {
  return { success: true, data };
}

function createError<TData>(error: string): TableViewActionResult<TData> {
  return { success: false, error };
}

export function createLocalTableViewActions(
  options: LocalTableViewActionsOptions = {}
): Required<TableViewActions> {
  const storage = resolveStorage(options.storage);
  const now = options.now ?? (() => new Date());
  const idFactory =
    options.idFactory ??
    (() =>
      `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  return {
    create: (
      input: CreateTableViewInput
    ): Promise<TableViewActionResult<TableView>> => {
      const name = input.name.trim();
      if (!name) {
        return Promise.resolve(createError("View name is required"));
      }

      const date = now();
      const view: TableView = {
        config: normalizeTableViewConfig(input.config),
        createdAt: date,
        createdById: "local",
        id: idFactory(),
        isDefault: input.isDefault === true,
        isGlobal: input.isGlobal === true,
        isSystem: false,
        name,
        tableId: input.tableId,
        updatedAt: date,
      };
      const currentViews = readViews(storage, input.tableId);
      const nextViews = normalizeDefaultViews(
        [...currentViews, view],
        view.isDefault ? view.id : undefined
      );

      writeViews(storage, input.tableId, nextViews);
      return Promise.resolve(createSuccess(view));
    },
    delete: (
      id: string,
      context: TableViewActionContext
    ): Promise<TableViewActionResult<{ id: string }>> => {
      const currentViews = readViews(storage, context.tableId);
      const targetView = currentViews.find((view) => view.id === id);
      if (!targetView) {
        return Promise.resolve(createError("View not found"));
      }
      if (targetView.isSystem) {
        return Promise.resolve(createError("Cannot delete a system view"));
      }

      writeViews(
        storage,
        context.tableId,
        currentViews.filter((view) => view.id !== id)
      );
      return Promise.resolve(createSuccess({ id }));
    },
    list: (context: TableViewActionContext) =>
      Promise.resolve({
        data: readViews(storage, context.tableId),
      }),
    update: (
      id: string,
      input: UpdateTableViewInput
    ): Promise<TableViewActionResult<TableView>> => {
      const currentViews = readViews(storage, input.tableId);
      const targetIndex = currentViews.findIndex((view) => view.id === id);
      if (targetIndex === -1) {
        return Promise.resolve(createError("View not found"));
      }

      const currentView = currentViews[targetIndex];
      if (currentView.isSystem) {
        return Promise.resolve(createError("Cannot update a system view"));
      }

      const nextView: TableView = {
        ...currentView,
        config: input.config
          ? normalizeTableViewConfig(input.config)
          : currentView.config,
        isDefault: input.isDefault ?? currentView.isDefault,
        isGlobal: input.isGlobal ?? currentView.isGlobal,
        name: input.name?.trim() || currentView.name,
        updatedAt: now(),
      };
      const nextViews = [...currentViews];
      nextViews[targetIndex] = nextView;

      writeViews(
        storage,
        input.tableId,
        normalizeDefaultViews(
          nextViews,
          nextView.isDefault ? nextView.id : undefined
        )
      );
      return Promise.resolve(createSuccess(nextView));
    },
  };
}
