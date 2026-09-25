"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DashboardColumn,
  type DashboardFilterValue,
  type DashboardStorage,
  type DashboardTableInfo,
  type DashboardView,
  type DashboardViewerFilters,
  dashboardColumn,
  loadDashboardViews,
  setDashboardViewerFilter,
} from "./dashboard-model";
import {
  canonicalDashboardJson,
  type Dashboard,
  type DashboardBlocks,
  normalizeDashboard,
} from "./dashboard-schema";
import {
  createDashboardSourceLoader,
  type DashboardSourceLoader,
  type DashboardSourceSummary,
  type DashboardSources,
} from "./dashboard-sources";
import {
  readDashboardUrlFilters,
  writeDashboardUrlFilters,
} from "./dashboard-url";
import type { DashboardTableSource } from "./dashboard-widget";

// Layout effects run before paint in the browser; the server skips them.
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DashboardLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "empty" }
  | { status: "error"; message: string };

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** What the dashboard knows of a loaded source: its name, columns and formats. */
export const tableInfo = (
  tableId: string,
  source: DashboardTableSource
): DashboardTableInfo => ({
  name: source.name ?? source.config.translations?.keys?.title ?? tableId,
  coloredTags: source.config.table.coloredTags,
  defaultDisplayMode: source.config.table.defaultDisplayMode,
  columns: source.config.columns.definitions.map((column) =>
    dashboardColumn(column as DashboardColumn)
  ),
});

/** A loaded source's summary, for the catalogue and reference checks. */
export const summarizeSource = (
  id: string,
  source: DashboardTableSource
): DashboardSourceSummary => ({
  id,
  name: tableInfo(id, source).name,
  columns: source.config.columns.definitions.map((column) => ({
    id: column.id,
    ...(typeof column.header === "string" ? { header: column.header } : {}),
    ...(column.type ? { type: String(column.type) } : {}),
  })),
  displayModes: [...(source.config.table.displayModes ?? ["table"])],
  views: (source.views ?? []).map((view) => ({
    id: view.id,
    name: view.name,
    ...(view.config.displayMode
      ? { displayMode: String(view.config.displayMode) }
      : {}),
  })),
});

type Provided = { dashboard: Dashboard } | { error: string } | undefined;

const readProvided = (input: unknown, blocks?: DashboardBlocks): Provided => {
  if (input === undefined) {
    return;
  }
  try {
    return { dashboard: normalizeDashboard(input, { blocks }) };
  } catch (error) {
    return { error: errorText(error) };
  }
};

const providedState = (provided: Provided): DashboardLoadState => {
  if (!provided) {
    return { status: "loading" };
  }
  return "error" in provided
    ? { status: "error", message: provided.error }
    : { status: "ready" };
};

/**
 * The document: `dashboard` when the host gives one (shown again when it
 * changes), else loaded from storage (`dashboardId`, else the first listed).
 * Documents are read with the host's blocks (misplaced blocks move).
 */
export function useDashboardDocument({
  blocks,
  dashboardId,
  input,
  storage,
}: {
  blocks?: DashboardBlocks;
  dashboardId?: string;
  input: unknown;
  storage?: DashboardStorage;
}) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const provided = useMemo(
    () => readProvided(input, blocksRef.current),
    [input]
  );
  const [dashboard, setDashboard] = useState<Dashboard | undefined>(() =>
    provided && "dashboard" in provided ? provided.dashboard : undefined
  );
  const [state, setState] = useState<DashboardLoadState>(() =>
    providedState(provided)
  );
  // Equal documents keep the edits in progress.
  const shown = useRef(
    provided && "dashboard" in provided
      ? canonicalDashboardJson(provided.dashboard)
      : ""
  );
  useEffect(() => {
    if (!provided) {
      return;
    }
    if ("dashboard" in provided) {
      const json = canonicalDashboardJson(provided.dashboard);
      if (json !== shown.current) {
        shown.current = json;
        setDashboard(provided.dashboard);
      }
    }
    setState(providedState(provided));
  }, [provided]);
  const given = input !== undefined;
  useEffect(() => {
    if (given) {
      return;
    }
    if (!storage) {
      setState({ status: "empty" });
      return;
    }
    let cancelled = false;
    const load = async () => {
      const id = dashboardId ?? (await storage.list()).at(0)?.id;
      if (!id) {
        return;
      }
      return normalizeDashboard(await storage.load(id), {
        blocks: blocksRef.current,
      });
    };
    setState({ status: "loading" });
    load()
      .then((loaded) => {
        if (!cancelled) {
          setDashboard(loaded);
          setState({ status: loaded ? "ready" : "empty" });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: errorText(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, given, storage]);
  return { dashboard, setDashboard, state };
}

/**
 * The screen's sources: `tables` (ready at once, winning over the catalogue)
 * and the lazy `sources`, loaded only for the ids asked. Re-renders when a
 * source's state changes.
 */
export function useDashboardSources({
  ids,
  sources,
  tables,
}: {
  ids: readonly string[];
  sources?: DashboardSources<DashboardTableSource>;
  tables?: Record<string, DashboardTableSource>;
}): { loader: DashboardSourceLoader<DashboardTableSource>; version: number } {
  const loader = useMemo(
    () =>
      createDashboardSourceLoader<DashboardTableSource>({
        sources,
        tables,
        summarize: summarizeSource,
      }),
    [sources, tables]
  );
  const [version, setVersion] = useState(0);
  useEffect(
    () => loader.subscribe(() => setVersion((value) => value + 1)),
    [loader]
  );
  const key = ids.join("\n");
  useEffect(() => {
    for (const id of key ? key.split("\n") : []) {
      loader.load(id).catch(() => undefined);
    }
  }, [key, loader]);
  return { loader, version };
}

/**
 * Saved views of the sources asked, once each is ready (static views, then
 * `views.list`); a source loaded anew (new tables or catalogue) asks again.
 */
export function useSourceViews(
  loader: DashboardSourceLoader<DashboardTableSource>,
  ids: readonly string[]
) {
  const [views, setViews] = useState<
    Record<string, DashboardView[] | undefined>
  >({});
  const asked = useRef(new Map<string, DashboardTableSource>());
  // Which of them are ready changes with the loader's states (each re-renders).
  const ready = JSON.stringify(
    ids.filter((id) => loader.state(id)?.status === "ready")
  );
  useEffect(() => {
    for (const id of JSON.parse(ready) as string[]) {
      const state = loader.state(id);
      if (state?.status !== "ready" || asked.current.get(id) === state.source) {
        continue;
      }
      const source = state.source;
      asked.current.set(id, source);
      loadDashboardViews(source, id)
        .catch(() => loadDashboardViews({ views: source.views }, id))
        .then((loaded) => {
          if (asked.current.get(id) === source) {
            setViews((current) => ({ ...current, [id]: loaded }));
          }
        })
        .catch(() => undefined);
    }
  }, [loader, ready]);
  return views;
}

/**
 * The values a reader picks for the filters: view state, synced to the URL
 * (`<dashboardId>.<filterId>`) unless `syncUrl` is false, never written to
 * the document. `ready` once the URL was read (after mounting, as the server
 * has no URL), so widgets query once, with the reader's values.
 */
export function useViewerFilters(
  dashboard: Pick<Dashboard, "id" | "filters"> | undefined,
  syncUrl: boolean
) {
  const [values, setValues] = useState<DashboardViewerFilters>({});
  const [ready, setReady] = useState(!syncUrl);
  const latest = useRef(values);
  latest.current = values;
  const current = useRef(dashboard);
  current.current = dashboard;
  const shape = dashboard
    ? JSON.stringify([
        dashboard.id,
        dashboard.filters.map((filter) => [filter.id, filter.type]),
      ])
    : "";
  useBrowserLayoutEffect(() => {
    if (!(shape && syncUrl)) {
      setReady(true);
      return;
    }
    const readUrl = () => {
      const doc = current.current;
      if (doc) {
        setValues(readDashboardUrlFilters(doc));
      }
    };
    readUrl();
    setReady(true);
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, [shape, syncUrl]);
  const write = useCallback(
    (next: DashboardViewerFilters) => {
      latest.current = next;
      setValues(next);
      const doc = current.current;
      if (syncUrl && doc) {
        writeDashboardUrlFilters(doc, next);
      }
    },
    [syncUrl]
  );
  const set = useCallback(
    (filterId: string, value: DashboardFilterValue | undefined) => {
      const doc = current.current;
      if (doc) {
        write(setDashboardViewerFilter(doc, latest.current, filterId, value));
      }
    },
    [write]
  );
  const clear = useCallback(() => write({}), [write]);
  return { values, set, clear, ready };
}

interface SourceRevision {
  /** "Refresh all" and refreshes of this source: every widget reloads. */
  refresh: number;
  /** Changes made in a page table: the source's other widgets reload. */
  mutation: number;
}

const MUTATION_DELAY = 150;

/**
 * When widgets load again: "Refresh all", a block's `refresh(tableId)`, and
 * changes made in a page table (grouped: an import or a bulk edit reloads
 * once).
 */
export function useDashboardRevisions() {
  const [revision, setRevision] = useState(0);
  const [sources, setSources] = useState<Record<string, SourceRevision>>({});
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const bump = useCallback(
    (ids: Iterable<string>, key: keyof SourceRevision) => {
      setSources((current) => {
        const next = { ...current };
        for (const id of ids) {
          const known = next[id] ?? { refresh: 0, mutation: 0 };
          next[id] = { ...known, [key]: known[key] + 1 };
        }
        return next;
      });
    },
    []
  );
  const refresh = useCallback(
    (tableId?: string) => {
      if (tableId) {
        bump([tableId], "refresh");
      } else {
        setRevision((value) => value + 1);
      }
    },
    [bump]
  );
  const mutated = useCallback(
    (tableId: string) => {
      pending.current.add(tableId);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const ids = [...pending.current];
        pending.current.clear();
        bump(ids, "mutation");
      }, MUTATION_DELAY);
    },
    [bump]
  );
  let total = 0;
  for (const entry of Object.values(sources)) {
    total += entry.refresh + entry.mutation;
  }
  return {
    revision,
    refresh,
    mutated,
    /** Numbers and views: "Refresh all", refreshes and changes of their source. */
    widgetRevision: (tableId?: string) => {
      const entry = tableId ? sources[tableId] : undefined;
      return revision + (entry ? entry.refresh + entry.mutation : 0);
    },
    /** Page tables: "Refresh all" and refreshes of their source (their own changes reload them already). */
    pageRevision: (tableId: string) =>
      revision + (sources[tableId]?.refresh ?? 0),
    /** Blocks: any of them. */
    blockRevision: revision + total,
  };
}
