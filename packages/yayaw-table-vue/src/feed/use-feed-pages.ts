import { type ComputedRef, computed, onBeforeUnmount, ref, watch } from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import {
  appendFeedRows,
  type FeedColumn,
  type FeedPagesRequest,
  loadFeedPages,
  type ResolvedFeedSettings,
} from "../feed-view";

type RowRecord = Record<string, unknown>;

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
  context: ComputedRef<DisplayModeRenderContext>,
  settings: ComputedRef<ResolvedFeedSettings>
) {
  const rows = ref<RowRecord[]>([]);
  const hasMore = ref(false);
  const loading = ref(true);
  const loadingMore = ref(false);
  const error = ref<string>();
  const attempt = ref(0);
  let pages = 1;
  let lastQuery = "";
  let pending: AbortController | undefined;

  const request = (page: number, count: number): FeedPagesRequest => {
    const current = context.value;
    return {
      list: current.list as FeedPagesRequest["list"],
      rows: current.list ? undefined : current.rows,
      params: current.listParams,
      columns: current.columns as unknown as FeedColumn[],
      settings: {
        dateColumn: settings.value.dateColumn,
        pageSize: settings.value.pageSize,
      },
      groupBy: current.groupBy,
      page,
      pages: count,
    };
  };
  const query = computed(() =>
    JSON.stringify({
      listParams: context.value.listParams,
      dateColumn: settings.value.dateColumn,
      pageSize: settings.value.pageSize,
      groupBy: context.value.groupBy,
    })
  );

  const reload = async () => {
    // A new query starts again from the first page; a mutation reloads what was shown.
    if (lastQuery !== query.value) {
      lastQuery = query.value;
      pages = 1;
    }
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    loading.value = true;
    error.value = undefined;
    try {
      const result = await loadFeedPages({
        ...request(1, pages),
        signal: controller.signal,
      });
      rows.value = result.rows;
      hasMore.value = result.hasMore;
      loadingMore.value = false;
    } catch (cause) {
      if (!isAbort(cause)) {
        error.value = errorText(cause);
      }
    } finally {
      if (pending === controller) {
        loading.value = false;
      }
    }
  };

  const loadMore = async () => {
    if (loading.value || loadingMore.value || !hasMore.value) {
      return;
    }
    const controller = new AbortController();
    pending = controller;
    const page = pages + 1;
    loadingMore.value = true;
    error.value = undefined;
    try {
      const result = await loadFeedPages({
        ...request(page, 1),
        signal: controller.signal,
      });
      pages = page;
      rows.value = appendFeedRows(rows.value, result.rows, (row) =>
        context.value.getRowId(row)
      );
      hasMore.value = result.hasMore;
    } catch (cause) {
      if (!isAbort(cause)) {
        error.value = errorText(cause);
      }
    } finally {
      loadingMore.value = false;
    }
  };

  watch(
    () => [
      query.value,
      context.value.list,
      context.value.list ? undefined : context.value.rows,
      context.value.revision,
      attempt.value,
    ],
    reload,
    { immediate: true }
  );
  onBeforeUnmount(() => pending?.abort());

  return {
    rows,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    retry: () => {
      attempt.value += 1;
    },
  };
}
