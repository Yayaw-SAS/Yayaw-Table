import {
  type ComputedRef,
  computed,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
  shallowRef,
  watch,
} from "vue";
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
  type DashboardSourceState,
  type DashboardSourceSummary,
  type DashboardSources,
} from "./dashboard-sources";
import type { DashboardTableSource } from "./dashboard-types";
import {
  readDashboardUrlFilters,
  writeDashboardUrlFilters,
} from "./dashboard-url";

export type DashboardLoadState =
  | { status: "loading" | "ready" | "empty" }
  | { status: "error"; message: string };

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** What the dashboard knows of a loaded source: its name, columns and formats. */
export const tableInfo = (
  tableId: string,
  source: DashboardTableSource
): DashboardTableInfo => ({
  name: source.name ?? source.config.translations?.keys?.title ?? tableId,
  coloredTags: source.config.table?.coloredTags,
  defaultDisplayMode: source.config.table?.defaultDisplayMode,
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
  displayModes: [...(source.config.table?.displayModes ?? ["table"])],
  views: (source.views ?? []).map((view) => ({
    id: view.id,
    name: view.name,
    ...(view.config.displayMode
      ? { displayMode: String(view.config.displayMode) }
      : {}),
  })),
});

/**
 * The document: `dashboard` when the host gives one (shown again when it
 * changes; equal documents keep the edits in progress), else loaded from
 * storage (`dashboardId`, else the first listed). Documents are read with the
 * host's blocks (misplaced blocks move).
 */
export function useDashboardDocument(options: {
  input: () => unknown;
  storage: () => DashboardStorage | undefined;
  dashboardId: () => string | undefined;
  blocks: () => DashboardBlocks | undefined;
}) {
  const dashboard = shallowRef<Dashboard>();
  const state = ref<DashboardLoadState>({ status: "loading" });
  let shown = "";
  let loading = 0;
  /** The host's document, shown when it changed. */
  const show = (input: unknown) => {
    try {
      const next = normalizeDashboard(input, { blocks: options.blocks() });
      const json = canonicalDashboardJson(next);
      if (json !== shown) {
        shown = json;
        dashboard.value = next;
      }
      state.value = { status: "ready" };
    } catch (error) {
      state.value = { status: "error", message: errorText(error) };
    }
  };
  /** The stored document (`dashboardId`, else the first listed). */
  const readStored = async (storage: DashboardStorage, attempt: number) => {
    state.value = { status: "loading" };
    try {
      const id = options.dashboardId() ?? (await storage.list())[0]?.id;
      const loaded = id
        ? normalizeDashboard(await storage.load(id), {
            blocks: options.blocks(),
          })
        : undefined;
      if (attempt === loading) {
        dashboard.value = loaded;
        state.value = { status: loaded ? "ready" : "empty" };
      }
    } catch (error) {
      if (attempt === loading) {
        state.value = { status: "error", message: errorText(error) };
      }
    }
  };
  const load = async () => {
    const attempt = ++loading;
    const input = options.input();
    const storage = options.storage();
    if (input !== undefined) {
      show(input);
    } else if (storage) {
      await readStored(storage, attempt);
    } else {
      state.value = { status: "empty" };
    }
  };
  watch(
    () => [options.input(), options.storage(), options.dashboardId()],
    load,
    { immediate: true }
  );
  return { dashboard, state };
}

/**
 * The screen's sources: `tables` (ready at once, winning over the catalogue)
 * and the lazy `sources`, loaded only for the ids asked. `stateOf` follows
 * each source's state reactively.
 */
export function useDashboardSources(options: {
  ids: () => readonly string[];
  sources: () => DashboardSources<DashboardTableSource> | undefined;
  tables: () => Record<string, DashboardTableSource> | undefined;
}): {
  loader: Ref<DashboardSourceLoader<DashboardTableSource>>;
  stateOf: (
    id: string
  ) => DashboardSourceState<DashboardTableSource> | undefined;
} {
  const create = () =>
    createDashboardSourceLoader<DashboardTableSource>({
      sources: options.sources(),
      tables: options.tables(),
      summarize: summarizeSource,
    });
  const loader = shallowRef(create());
  // The loader's states, copied on each change so templates follow them.
  const states = shallowRef(
    new Map<string, DashboardSourceState<DashboardTableSource> | undefined>()
  );
  const follow = (current: DashboardSourceLoader<DashboardTableSource>) =>
    current.subscribe((id) => {
      states.value = new Map(states.value).set(id, current.state(id));
    });
  let unsubscribe = follow(loader.value);
  watch([options.sources, options.tables], () => {
    unsubscribe();
    loader.value = create();
    states.value = new Map();
    unsubscribe = follow(loader.value);
  });
  onBeforeUnmount(() => unsubscribe());
  watch(
    () => [loader.value, options.ids().join("\n")] as const,
    ([current, key]) => {
      for (const id of key ? key.split("\n") : []) {
        current.load(id).catch(() => undefined);
      }
    },
    { immediate: true }
  );
  return { loader, stateOf: (id) => states.value.get(id) };
}

/**
 * Saved views of the sources asked, once each is ready (static views, then
 * `views.list`); a source loaded anew (new tables or catalogue) asks again.
 */
export function useSourceViews(
  stateOf: (
    id: string
  ) => DashboardSourceState<DashboardTableSource> | undefined,
  ids: () => readonly string[]
): Ref<Record<string, DashboardView[] | undefined>> {
  const views = ref<Record<string, DashboardView[] | undefined>>({});
  const asked = new Map<string, DashboardTableSource>();
  watch(
    () => ids().filter((id) => stateOf(id)?.status === "ready"),
    (ready) => {
      for (const id of ready) {
        const state = stateOf(id);
        if (state?.status !== "ready" || asked.get(id) === state.source) {
          continue;
        }
        const source = state.source;
        asked.set(id, source);
        loadDashboardViews(source, id)
          .catch(() => loadDashboardViews({ views: source.views }, id))
          .then((loaded) => {
            if (asked.get(id) === source) {
              views.value = { ...views.value, [id]: loaded };
            }
          })
          .catch(() => undefined);
      }
    },
    { immediate: true }
  );
  return views;
}

/**
 * The values a reader picks for the filters: view state, synced to the URL
 * (`<dashboardId>.<filterId>`) unless `syncUrl` is false, never written to
 * the document. `ready` once the URL was read (after mounting, as the server
 * has no URL), so widgets query once, with the reader's values.
 */
export function useViewerFilters(
  dashboard: () => Pick<Dashboard, "id" | "filters"> | undefined,
  syncUrl: () => boolean
) {
  const values = shallowRef<DashboardViewerFilters>({});
  const mounted = ref(false);
  const ready = computed(() => mounted.value || !syncUrl());
  const shape = computed(() => {
    const doc = dashboard();
    return doc
      ? JSON.stringify([
          doc.id,
          doc.filters.map((filter) => [filter.id, filter.type]),
        ])
      : "";
  });
  const readUrl = () => {
    const doc = dashboard();
    if (doc && syncUrl()) {
      values.value = readDashboardUrlFilters(doc);
    }
  };
  watch([shape, syncUrl], () => {
    if (mounted.value) {
      readUrl();
    }
  });
  onMounted(() => {
    readUrl();
    mounted.value = true;
    window.addEventListener("popstate", readUrl);
  });
  onBeforeUnmount(() => window.removeEventListener("popstate", readUrl));
  const write = (next: DashboardViewerFilters) => {
    values.value = next;
    const doc = dashboard();
    if (doc && syncUrl()) {
      writeDashboardUrlFilters(doc, next);
    }
  };
  const set = (filterId: string, value: DashboardFilterValue | undefined) => {
    const doc = dashboard();
    if (doc) {
      write(setDashboardViewerFilter(doc, values.value, filterId, value));
    }
  };
  return { values, set, clear: () => write({}), ready };
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
  const revision = ref(0);
  const sources = shallowRef<Record<string, SourceRevision>>({});
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onBeforeUnmount(() => clearTimeout(timer));
  const bump = (ids: Iterable<string>, key: keyof SourceRevision) => {
    const next = { ...sources.value };
    for (const id of ids) {
      const known = next[id] ?? { refresh: 0, mutation: 0 };
      next[id] = { ...known, [key]: known[key] + 1 };
    }
    sources.value = next;
  };
  const refresh = (tableId?: string) => {
    if (tableId) {
      bump([tableId], "refresh");
    } else {
      revision.value += 1;
    }
  };
  const mutated = (tableId: string) => {
    pending.add(tableId);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ids = [...pending];
      pending.clear();
      bump(ids, "mutation");
    }, MUTATION_DELAY);
  };
  const blockRevision: ComputedRef<number> = computed(() => {
    let total = revision.value;
    for (const entry of Object.values(sources.value)) {
      total += entry.refresh + entry.mutation;
    }
    return total;
  });
  return {
    revision,
    refresh,
    mutated,
    /** Numbers and views: "Refresh all", refreshes and changes of their source. */
    widgetRevision: (tableId?: string) => {
      const entry = tableId ? sources.value[tableId] : undefined;
      return revision.value + (entry ? entry.refresh + entry.mutation : 0);
    },
    /** Page tables: "Refresh all" and refreshes of their source (their own changes reload them already). */
    pageRevision: (tableId: string) =>
      revision.value + (sources.value[tableId]?.refresh ?? 0),
    /** Blocks: any of them. */
    blockRevision,
  };
}
