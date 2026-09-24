"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  appendFeedRows,
  type FeedColumn,
  loadFeedPages,
  type ResolvedFeedSettings,
} from "../utils/feed-view";

type RowRecord = Record<string, unknown>;

export interface FeedPagesState {
  rows: RowRecord[];
  hasMore: boolean;
  /** First page (or a reload) in progress. */
  loading: boolean;
  /** "Load more" in progress. */
  loadingMore: boolean;
  error?: string;
  loadMore: () => void;
  retry: () => void;
}

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);
const isAbort = (cause: unknown) =>
  cause instanceof DOMException && cause.name === "AbortError";

/**
 * Pages of the feed from `list` (or the local rows): the first page when the
 * query or settings change, the pages shown so far again after a mutation,
 * and the next page on "Load more".
 */
export function useFeedPages(
  context: DisplayModeRenderContext,
  settings: ResolvedFeedSettings
): FeedPagesState {
  const { columns, getRowId, groupBy, list, listParams, revision } = context;
  const localRows = list ? undefined : context.rows;
  const [state, setState] = useState<
    Omit<FeedPagesState, "loadMore" | "retry">
  >({ rows: [], hasMore: false, loading: true, loadingMore: false });
  const pagesRef = useRef(1);
  const queryRef = useRef("");
  const pending = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { dateColumn, pageSize } = settings;
  const query = JSON.stringify({ listParams, dateColumn, pageSize, groupBy });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` and `attempt` reload on purpose.
  useEffect(() => {
    // A new query starts again from the first page; a mutation reloads what was shown.
    if (queryRef.current !== query) {
      queryRef.current = query;
      pagesRef.current = 1;
    }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    loadFeedPages({
      list: list as Parameters<typeof loadFeedPages>[0]["list"],
      rows: localRows,
      params: listParams,
      columns: columns as FeedColumn[],
      settings: { dateColumn, pageSize },
      groupBy,
      page: 1,
      pages: pagesRef.current,
      signal: controller.signal,
    })
      .then((result) => {
        setState({
          rows: result.rows,
          hasMore: result.hasMore,
          loading: false,
          loadingMore: false,
        });
      })
      .catch((cause: unknown) => {
        if (!isAbort(cause)) {
          setState((current) => ({
            ...current,
            loading: false,
            loadingMore: false,
            error: errorText(cause),
          }));
        }
      });
    return () => controller.abort();
  }, [query, list, localRows, revision, attempt]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || !state.hasMore) {
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    const page = pagesRef.current + 1;
    setState((current) => ({
      ...current,
      loadingMore: true,
      error: undefined,
    }));
    loadFeedPages({
      list: list as Parameters<typeof loadFeedPages>[0]["list"],
      rows: localRows,
      params: listParams,
      columns: columns as FeedColumn[],
      settings: { dateColumn, pageSize },
      groupBy,
      page,
      signal: controller.signal,
    })
      .then((result) => {
        pagesRef.current = page;
        setState((current) => ({
          rows: appendFeedRows(current.rows, result.rows, getRowId),
          hasMore: result.hasMore,
          loading: false,
          loadingMore: false,
        }));
      })
      .catch((cause: unknown) => {
        if (!isAbort(cause)) {
          setState((current) => ({
            ...current,
            loadingMore: false,
            error: errorText(cause),
          }));
        }
      });
  }, [
    columns,
    dateColumn,
    getRowId,
    groupBy,
    list,
    listParams,
    localRows,
    pageSize,
    state.hasMore,
    state.loading,
    state.loadingMore,
  ]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, loadMore, retry };
}
