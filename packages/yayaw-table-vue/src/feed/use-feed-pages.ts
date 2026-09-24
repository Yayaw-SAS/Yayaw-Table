import {
  type ComputedRef,
  computed,
  onBeforeUnmount,
  type ShallowRef,
  shallowRef,
  watch,
} from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import {
  createFeedPages,
  type FeedPagesState,
  type FeedPagesStore,
} from "../feed-controller";
import type {
  FeedColumn,
  FeedPagesRequest,
  ResolvedFeedSettings,
} from "../feed-view";

export interface FeedPages {
  state: ShallowRef<FeedPagesState>;
  loadMore: FeedPagesStore["loadMore"];
  retry: FeedPagesStore["retry"];
}

/**
 * Pages of the feed from `list` (or the local rows) through the shared store:
 * the first page when the query or settings change, the pages shown so far
 * again after a mutation, and the next page on scroll or "Load more".
 */
export function useFeedPages(
  context: ComputedRef<DisplayModeRenderContext>,
  settings: ComputedRef<ResolvedFeedSettings>
): FeedPages {
  const store = createFeedPages();
  const state = shallowRef(store.getState());
  const unsubscribe = store.subscribe(() => {
    state.value = store.getState();
  });
  const query = computed(() =>
    JSON.stringify({
      listParams: context.value.listParams,
      dateColumn: settings.value.dateColumn,
      pageSize: settings.value.pageSize,
      groupBy: context.value.groupBy,
    })
  );

  watch(
    () => [
      query.value,
      context.value.list,
      context.value.list ? undefined : context.value.rows,
      context.value.revision,
    ],
    () => {
      const current = context.value;
      store.load(
        {
          list: current.list as FeedPagesRequest["list"],
          rows: current.list ? undefined : current.rows,
          params: current.listParams,
          columns: current.columns as unknown as FeedColumn[],
          settings: {
            dateColumn: settings.value.dateColumn,
            pageSize: settings.value.pageSize,
          },
          groupBy: current.groupBy,
          getRowId: (row) => current.getRowId(row),
        },
        query.value
      );
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    unsubscribe();
    store.dispose();
  });

  return {
    state,
    loadMore: (manual) => store.loadMore(manual),
    retry: () => store.retry(),
  };
}
