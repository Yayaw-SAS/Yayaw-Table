/**
 * Sources of dashboards and screens: what a host lets widgets show (its
 * tables, a catalogue of system or model sources). Editors and AI tools read
 * summaries (`list`); readers load a source when a widget needs it (`load`).
 * A source the user may not see, or one that is not configured, is
 * unavailable: its widgets say so and are never removed from the document.
 * Pure and server-safe, shared by the React and Vue editions (synced to Vue).
 */
import type { FormText } from "../form-text";

/** Why a source cannot be shown. */
export const DASHBOARD_SOURCE_UNAVAILABLE_REASONS = [
  "forbidden",
  "notConfigured",
  "notFound",
  "error",
] as const;
export type DashboardSourceUnavailableReason =
  (typeof DASHBOARD_SOURCE_UNAVAILABLE_REASONS)[number];

export interface DashboardSourceColumn {
  id: string;
  header?: FormText;
  type?: string;
}

/** A saved view of a source. */
export interface DashboardSourceView {
  id: string;
  name?: FormText;
  displayMode?: string;
}

/**
 * What an editor, an AI tool or `checkDashboardReferences` knows of a source
 * without loading it. Leave out what is unknown: `columns`, `views` and
 * `displayModes` are only checked when given.
 */
export interface DashboardSourceSummary {
  id: string;
  name: FormText;
  description?: FormText;
  /** Heading the source is listed under, e.g. "CMS" or "Models". */
  group?: FormText;
  /** Words a search matches besides the name. */
  keywords?: string[];
  columns?: DashboardSourceColumn[];
  displayModes?: string[];
  views?: DashboardSourceView[];
  /** False when this user cannot use the source (then see `unavailableReason`). */
  available?: boolean;
  unavailableReason?: DashboardSourceUnavailableReason;
  unavailableMessage?: string;
}

/** What `load` answers for a source that cannot be shown. */
export interface DashboardSourceUnavailable {
  unavailable: true;
  reason?: DashboardSourceUnavailableReason;
  message?: string;
}

/** A host's lazy catalogue of sources; `S` is a loaded source (config, actions, views). */
export interface DashboardSources<S> {
  list: () => Promise<readonly DashboardSourceSummary[]>;
  load: (id: string) => Promise<S | DashboardSourceUnavailable>;
}

export type DashboardSourceState<S> =
  | { status: "loading" }
  | { status: "ready"; source: S }
  | {
      status: "unavailable";
      reason: DashboardSourceUnavailableReason;
      message?: string;
    }
  | { status: "error"; message: string; error: unknown };

export interface DashboardSourceLoaderOptions<S> {
  /** The lazy catalogue. */
  sources?: DashboardSources<S>;
  /** Sources given up front, by id; they win over the catalogue's. */
  tables?: Readonly<Record<string, S>>;
  /** The summary of a source given up front or loaded. */
  summarize: (id: string, source: S) => DashboardSourceSummary;
}

export interface DashboardSourceLoader<S> {
  /** A source's state now; undefined before its first load. */
  state: (id: string) => DashboardSourceState<S> | undefined;
  /**
   * Loads a source once: concurrent calls share one request, and ready,
   * unavailable and failed states are kept (see `retry`).
   */
  load: (id: string) => Promise<DashboardSourceState<S>>;
  /** Loads again a source whose load failed; others keep their state. */
  retry: (id: string) => Promise<DashboardSourceState<S>>;
  /** Summaries of every source: the tables first, then the catalogue's others. */
  list: () => Promise<DashboardSourceSummary[]>;
  /** The summary of a listed or loaded source. */
  summary: (id: string) => DashboardSourceSummary | undefined;
  /** Calls `listener` with the id of each source whose state changes. */
  subscribe: (listener: (id: string) => void) => () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether `load` answered that the source cannot be shown. */
export const isDashboardSourceUnavailable = (
  value: unknown
): value is DashboardSourceUnavailable =>
  isRecord(value) && value.unavailable === true;

const reasonOf = (value: unknown): DashboardSourceUnavailableReason =>
  (DASHBOARD_SOURCE_UNAVAILABLE_REASONS as readonly unknown[]).includes(value)
    ? (value as DashboardSourceUnavailableReason)
    : "notFound";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Loads sources for a dashboard: `tables` first (ready at once), else the
 * catalogue's `load`, once per source (concurrent loads share a request).
 * Ready and unavailable sources are cached for good; a failed load is kept
 * as an error until `retry`.
 */
export function createDashboardSourceLoader<S>(
  options: DashboardSourceLoaderOptions<S>
): DashboardSourceLoader<S> {
  const states = new Map<string, DashboardSourceState<S>>();
  const pending = new Map<string, Promise<DashboardSourceState<S>>>();
  const summaries = new Map<string, DashboardSourceSummary>();
  const listeners = new Set<(id: string) => void>();
  let listing: Promise<DashboardSourceSummary[]> | undefined;

  const set = (
    id: string,
    state: DashboardSourceState<S>
  ): DashboardSourceState<S> => {
    states.set(id, state);
    for (const listener of listeners) {
      listener(id);
    }
    return state;
  };
  const table = (id: string): S | undefined =>
    options.tables && Object.hasOwn(options.tables, id)
      ? options.tables[id]
      : undefined;
  const summarize = (id: string, source: S): DashboardSourceSummary => ({
    ...options.summarize(id, source),
    id,
  });

  const read = async (id: string): Promise<DashboardSourceState<S>> => {
    const result = await options.sources?.load(id);
    if (result === undefined || result === null) {
      return { status: "unavailable", reason: "notFound" };
    }
    if (isDashboardSourceUnavailable(result)) {
      return {
        status: "unavailable",
        reason: reasonOf(result.reason),
        ...(typeof result.message === "string"
          ? { message: result.message }
          : {}),
      };
    }
    summaries.set(id, summarize(id, result));
    return { status: "ready", source: result };
  };

  // `read` awaits before this settles, so `pending` is set by then.
  const run = async (id: string): Promise<DashboardSourceState<S>> => {
    let state: DashboardSourceState<S>;
    try {
      state = await read(id);
    } catch (error) {
      state = { status: "error", message: errorMessage(error), error };
    }
    pending.delete(id);
    return set(id, state);
  };

  const load = (id: string): Promise<DashboardSourceState<S>> => {
    const running = pending.get(id);
    if (running) {
      return running;
    }
    const known = states.get(id);
    if (known) {
      return Promise.resolve(known);
    }
    const own = table(id);
    if (own !== undefined) {
      summaries.set(id, summarize(id, own));
      return Promise.resolve(set(id, { status: "ready", source: own }));
    }
    if (!options.sources) {
      return Promise.resolve(
        set(id, { status: "unavailable", reason: "notFound" })
      );
    }
    set(id, { status: "loading" });
    const promise = run(id);
    pending.set(id, promise);
    return promise;
  };

  const readList = async (): Promise<DashboardSourceSummary[]> => {
    const own = Object.entries(options.tables ?? {}).map(([id, source]) =>
      summarize(id, source)
    );
    const ids = new Set(own.map((summary) => summary.id));
    const listed = options.sources ? await options.sources.list() : [];
    const others = listed.filter(
      (summary) =>
        isRecord(summary) &&
        typeof summary.id === "string" &&
        !ids.has(summary.id)
    );
    for (const summary of [...own, ...others]) {
      if (!summaries.has(summary.id)) {
        summaries.set(summary.id, summary);
      }
    }
    return [...own, ...others];
  };

  return {
    state: (id) => states.get(id),
    load,
    retry: (id) => {
      if (states.get(id)?.status === "error") {
        states.delete(id);
      }
      return load(id);
    },
    list: async () => {
      listing ??= readList();
      try {
        return await listing;
      } catch (error) {
        listing = undefined;
        throw error;
      }
    },
    summary: (id) => summaries.get(id),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
