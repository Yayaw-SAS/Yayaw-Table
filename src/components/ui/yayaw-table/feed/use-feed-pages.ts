"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  createFeedPages,
  type FeedPagesState,
  type FeedPagesStore,
} from "../utils/feed-controller";
import type {
  FeedColumn,
  FeedPagesRequest,
  ResolvedFeedSettings,
} from "../utils/feed-view";

export interface FeedPages extends FeedPagesState {
  loadMore: FeedPagesStore["loadMore"];
  retry: FeedPagesStore["retry"];
}

/**
 * Pages of the feed from `list` (or the local rows) through the shared store:
 * the first page when the query or settings change, the pages shown so far
 * again after a mutation, and the next page on scroll or "Load more".
 */
export function useFeedPages(
  context: DisplayModeRenderContext,
  settings: ResolvedFeedSettings
): FeedPages {
  const [store] = useState(createFeedPages);
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );
  const { columns, getRowId, groupBy, list, listParams, revision } = context;
  const localRows = list ? undefined : context.rows;
  const { dateColumn, pageSize } = settings;
  const query = JSON.stringify({ listParams, dateColumn, pageSize, groupBy });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `query` stands for the list parameters; `revision` reloads the pages shown on purpose.
  useEffect(() => {
    store.load(
      {
        list: list as FeedPagesRequest["list"],
        rows: localRows,
        params: listParams,
        columns: columns as FeedColumn[],
        settings: { dateColumn, pageSize },
        groupBy,
        getRowId,
      },
      query
    );
  }, [query, list, localRows, revision, store]);
  useEffect(() => () => store.dispose(), [store]);

  return { ...state, loadMore: store.loadMore, retry: store.retry };
}
