/**
 * Feed pages as a framework-neutral store (synced to Vue by `contracts:sync`):
 * React subscribes with `useSyncExternalStore`, Vue with a `shallowRef`. It
 * loads the first page for a new query, reloads the pages shown after a
 * change, appends the next page one request at a time, stops at the end and
 * keeps the posts shown when a next page fails, until `retry`.
 */
import {
  appendFeedRows,
  type FeedLabelKey,
  type FeedPagesRequest,
  loadFeedPages,
} from "./feed-view";

type Row = Record<string, unknown>;

/** The page appended last, for the live region and focus. */
export interface FeedAppended {
  /** New posts (posts already shown are left out). */
  count: number;
  /** Posts shown after it. */
  total: number;
  /** The first new post's id. */
  firstId?: string;
  /** Asked with the button, not by scrolling. */
  manual: boolean;
}

export interface FeedPagesState {
  rows: Row[];
  /** Another page can be loaded. */
  hasMore: boolean;
  /** The host's `meta.totalCount`, when it answers one. */
  totalCount?: number;
  /** Pages shown. */
  pages: number;
  /** The first page (or a reload of the pages shown) is loading. */
  loading: boolean;
  /** The next page is loading. */
  loadingMore: boolean;
  /** The first page or a reload failed. */
  error?: string;
  /** The next page failed: the posts shown stay and scrolling loads nothing until `retry`. */
  moreError?: string;
  appended?: FeedAppended;
}

/** Where pages come from: the request without its page, plus row ids. */
export interface FeedPagesSource
  extends Omit<FeedPagesRequest, "page" | "pages" | "signal"> {
  getRowId: (row: Row) => string;
}

export interface FeedPagesStore {
  getState: () => FeedPagesState;
  subscribe: (listener: () => void) => () => void;
  /**
   * Load the first page when `key` (the query) changed, else reload the pages
   * shown, e.g. after a mutation. A load in progress is dropped.
   */
  load: (source: FeedPagesSource, key: string) => Promise<void>;
  /** Append the next page; nothing while a request runs, after an error or at the end. */
  loadMore: (manual?: boolean) => Promise<void>;
  /** After an error: the failed next page (asked by a person), else the whole load again. */
  retry: () => Promise<void>;
  /** Drop the request in progress; the store stays usable. */
  dispose: () => void;
}

const INITIAL_STATE: FeedPagesState = {
  rows: [],
  hasMore: false,
  pages: 1,
  loading: true,
  loadingMore: false,
};

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

export function createFeedPages(): FeedPagesStore {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let source: FeedPagesSource | undefined;
  let key: string | undefined;
  // The only request in progress; answers of dropped ones are ignored.
  let pending: AbortController | undefined;

  const set = (patch: Partial<FeedPagesState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  };
  const begin = () => {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    return controller;
  };
  /** Whether this request is still the current one (then it is done). */
  const finish = (controller: AbortController) => {
    if (pending !== controller) {
      return false;
    }
    pending = undefined;
    return true;
  };

  const reload = async (next: FeedPagesSource, pages: number) => {
    const controller = begin();
    set({
      loading: true,
      loadingMore: false,
      error: undefined,
      moreError: undefined,
    });
    try {
      const result = await loadFeedPages({
        ...next,
        page: 1,
        pages,
        signal: controller.signal,
      });
      if (finish(controller)) {
        set({
          rows: result.rows,
          hasMore: result.hasMore,
          totalCount: result.totalCount,
          pages,
          loading: false,
          appended: undefined,
        });
      }
    } catch (cause) {
      if (finish(controller)) {
        set({ loading: false, error: errorText(cause) });
      }
    }
  };

  const loadMore = async (manual = false) => {
    const current = source;
    const busy = pending !== undefined || state.loading || state.loadingMore;
    if (!(current && state.hasMore) || busy || state.moreError !== undefined) {
      return;
    }
    const { getRowId } = current;
    const controller = begin();
    const page = state.pages + 1;
    set({ loadingMore: true });
    try {
      const result = await loadFeedPages({
        ...current,
        page,
        pages: 1,
        signal: controller.signal,
      });
      if (!finish(controller)) {
        return;
      }
      const rows = appendFeedRows(state.rows, result.rows, getRowId);
      const first = rows.at(state.rows.length);
      set({
        rows,
        hasMore: result.hasMore,
        totalCount: result.totalCount ?? state.totalCount,
        pages: page,
        loadingMore: false,
        appended: {
          count: rows.length - state.rows.length,
          total: rows.length,
          firstId: first ? getRowId(first) : undefined,
          manual,
        },
      });
    } catch (cause) {
      if (finish(controller)) {
        set({ loadingMore: false, moreError: errorText(cause) });
      }
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: async (next, nextKey) => {
      const reset = nextKey !== key;
      source = next;
      key = nextKey;
      await reload(next, reset ? 1 : state.pages);
    },
    loadMore,
    retry: async () => {
      if (state.moreError !== undefined) {
        set({ moreError: undefined });
        await loadMore(true);
      } else if (source) {
        await reload(source, state.pages);
      }
    },
    dispose: () => {
      pending?.abort();
      pending = undefined;
    },
  };
}

type FeedLabeler = (
  key: FeedLabelKey,
  params?: Record<string, number | string>
) => string;

/**
 * What the polite live region says after a page: how many posts came and how
 * many show, then that the feed is complete.
 */
export function feedLoadAnnouncement(
  state: Pick<FeedPagesState, "appended" | "hasMore">,
  label: FeedLabeler
): string {
  const { appended, hasMore } = state;
  if (!appended) {
    return "";
  }
  const parts: string[] = [];
  if (appended.count > 0) {
    parts.push(
      appended.count === 1
        ? label("loadedOne", { total: appended.total })
        : label("loadedMany", {
            count: appended.count,
            total: appended.total,
          })
    );
  }
  if (!hasMore) {
    parts.push(`${label("end")}.`);
  }
  return parts.join(" ");
}
