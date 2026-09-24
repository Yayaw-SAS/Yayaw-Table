<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import {
  computed,
  onBeforeUnmount,
  onUpdated,
  ref,
  shallowRef,
  watch,
} from "vue";
import TableEmptyState from "../components/table/TableEmptyState.vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import { type FeedAppended, feedLoadAnnouncement } from "../feed-controller";
import {
  canObserveFeedEnd,
  createFeedHeights,
  type FeedEndObserver,
  type FeedWindowTracker,
  focusFeedPost,
  observeFeedEnd,
  trackFeedWindow,
} from "../feed-dom";
import {
  type FeedColumn,
  type FeedLabelKey,
  type FeedViewSettings,
  feedBodyRenderer,
  feedLabel,
  feedWindowThreshold,
  groupFeedRows,
  resolveFeedSettings,
} from "../feed-view";
import FeedCard from "./FeedCard.vue";
import FeedLoading from "./FeedLoading.vue";
import { useFeedPages } from "./use-feed-pages";
import "../tag-colors.css";
import "./feed.css";

const props = defineProps<{ context: DisplayModeRenderContext }>();

const label = (
  key: FeedLabelKey,
  params?: Record<string, number | string>
): string =>
  feedLabel(
    key,
    props.context.locale,
    (name, fallback) => props.context.translate(`feed.${name}`, fallback),
    params
  );
const context = computed(() => props.context);
const columns = computed(
  () => props.context.columns as unknown as FeedColumn[]
);
const settings = computed(() =>
  resolveFeedSettings(
    columns.value,
    props.context.defaults as FeedViewSettings,
    props.context.settings as FeedViewSettings,
    props.context.groupBy
  )
);
const columnMap = computed(
  () => new Map(columns.value.map((column) => [column.id, column]))
);
const feed = useFeedPages(context, settings);
const state = computed(() => feed.state.value);
// Relative dates read against the time the rows arrived.
const now = ref(new Date());
watch(
  () => state.value.rows,
  () => {
    now.value = new Date();
  }
);
const sections = computed(() =>
  groupFeedRows(
    state.value.rows,
    props.context.groupBy
      ? columnMap.value.get(props.context.groupBy)
      : undefined,
    label("noValue")
  )
);
const positions = computed(
  () => new Map(state.value.rows.map((row, index) => [row, index + 1]))
);
const renderBody = computed(() => feedBodyRenderer(props.context.defaults));
const setSize = computed(() =>
  state.value.hasMore ? (state.value.totalCount ?? -1) : state.value.rows.length
);
const announcement = computed(() => feedLoadAnnouncement(state.value, label));

// "Show more" is kept per record so it survives windowing and new pages.
const expanded = shallowRef<ReadonlySet<string>>(new Set());
const toggleExpanded = (id: string) => {
  const next = new Set(expanded.value);
  if (!next.delete(id)) {
    next.add(id);
  }
  expanded.value = next;
};

// Long feeds render only the posts near the viewport; the others keep their height.
const heights = createFeedHeights();
const threshold = computed(() => feedWindowThreshold(props.context.defaults));
const windowed = computed(
  () =>
    threshold.value !== undefined && state.value.rows.length > threshold.value
);
const shown = shallowRef<ReadonlySet<string> | null>(null);
const list = ref<HTMLElement>();
let tracker: FeedWindowTracker | undefined;
watch(
  list,
  (element) => {
    tracker?.disconnect();
    tracker = element
      ? trackFeedWindow(element, {
          heights,
          onChange: (ids) => {
            shown.value = ids;
          },
        })
      : undefined;
    tracker?.update(windowed.value);
  },
  { flush: "post" }
);
// After every render: measure the posts shown and move the window.
onUpdated(() => tracker?.update(windowed.value));
const rendered = (id: string): boolean =>
  !(windowed.value && shown.value) || shown.value.has(id) || !heights.has(id);

// Pages load as the end comes within a screen of the viewport, one request at
// a time. The button stays for the keyboard (shown when focused), shows
// without IntersectionObserver or with `infiniteScroll` off, and reads
// "Retry" after a page failed.
const auto = computed(
  () =>
    settings.value.infiniteScroll &&
    state.value.moreError === undefined &&
    canObserveFeedEnd()
);
const quiet = computed(() => auto.value && !state.value.loadingMore);
const buttonText = computed(() => {
  if (state.value.loadingMore) {
    return label("loadingMore");
  }
  return state.value.moreError === undefined
    ? label("loadMore")
    : label("retry");
});
const sentinel = ref<HTMLElement>();
let observer: FeedEndObserver | undefined;
// Each page observes again, so the next one loads while the end stays near.
watch(
  [
    sentinel,
    auto,
    () => state.value.hasMore,
    () => state.value.loading,
    () => state.value.pages,
  ],
  () => {
    observer?.disconnect();
    observer = undefined;
    const element = sentinel.value;
    if (
      !(auto.value && state.value.hasMore && element) ||
      state.value.loading
    ) {
      return;
    }
    observer = observeFeedEnd(element, () => {
      feed.loadMore();
    });
  },
  { flush: "post" }
);

// "Load more" keeps focus while pages remain; it goes away with the last
// page, and focus moves to the first new post instead of being lost.
let pendingFocus: { after?: FeedAppended } | null = null;
const activate = () => {
  pendingFocus = { after: state.value.appended };
  if (state.value.moreError === undefined) {
    feed.loadMore(true);
  } else {
    feed.retry();
  }
};
watch(
  () => state.value.appended,
  (appended) => {
    if (!pendingFocus || appended === pendingFocus.after) {
      return;
    }
    pendingFocus = null;
    if (appended?.manual && !state.value.hasMore && list.value) {
      const last = state.value.rows.at(-1);
      focusFeedPost(
        list.value,
        appended.firstId ?? (last && props.context.getRowId(last))
      );
    }
  },
  { flush: "post" }
);

onBeforeUnmount(() => {
  observer?.disconnect();
  tracker?.disconnect();
});
</script>

<template>
  <FeedLoading
    v-if="state.loading && state.rows.length === 0"
    :label="label('loading')"
  />
  <div
    v-else-if="state.error && state.rows.length === 0"
    class="yayaw-feed-view yayaw-feed-failed"
    data-feed-view
  >
    <p class="yayaw-feed-error" role="alert">{{ label("error") }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline" @click="feed.retry()">
      {{ label("retry") }}
    </button>
  </div>
  <div v-else-if="state.rows.length === 0" class="yayaw-feed-view" data-feed-view>
    <TableEmptyState />
  </div>
  <div
    v-else
    class="yayaw-feed-view"
    :data-density="settings.density"
    data-feed-view
    :data-windowed="windowed ? '' : undefined"
  >
    <div
      ref="list"
      class="yayaw-feed-list"
      role="feed"
      :aria-busy="state.loading || state.loadingMore"
    >
      <section
        v-for="section in sections"
        :key="section.id"
        class="yayaw-feed-section"
        :aria-label="section.label || undefined"
        :data-feed-section="section.label ? section.id : undefined"
      >
        <h2 v-if="section.label" class="yayaw-feed-section-title">
          <span>{{ section.label }}</span>
          <span class="yayaw-feed-section-count">{{ section.rows.length }}</span>
        </h2>
        <template v-for="row in section.rows" :key="props.context.getRowId(row)">
          <FeedCard
            v-if="rendered(props.context.getRowId(row))"
            :row="row"
            :row-id="props.context.getRowId(row)"
            :columns="columnMap"
            :settings="settings"
            :locale="props.context.locale"
            :colored-tags="props.context.coloredTags"
            :label="label"
            :render-body="renderBody"
            :now="now"
            :position="positions.get(row) ?? 0"
            :set-size="setSize"
            :expanded="expanded.has(props.context.getRowId(row))"
            :gallery="props.context.media"
            :image-column="props.context.imageColumn"
            @open="(row, event) => props.context.openRow(row, event)"
            @toggle="toggleExpanded"
          />
          <div
            v-else
            class="yayaw-feed-placeholder"
            aria-hidden="true"
            data-feed-item
            data-feed-placeholder
            :data-row-id="props.context.getRowId(row)"
            :style="{ height: `${heights.heightOf(props.context.getRowId(row))}px` }"
          />
        </template>
      </section>
    </div>
    <p v-if="state.error" class="yayaw-feed-error" role="alert">{{ label("error") }}</p>
    <div
      v-if="state.hasMore"
      ref="sentinel"
      class="yayaw-feed-footer"
      data-feed-footer
    >
      <p v-if="state.moreError !== undefined" class="yayaw-feed-error" role="alert">
        {{ label("loadMoreError") }}
      </p>
      <button
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-feed-load-more"
        data-feed-load-more
        :data-quiet="quiet ? '' : undefined"
        :aria-disabled="state.loadingMore ? 'true' : undefined"
        :aria-busy="state.loadingMore"
        @click="state.loadingMore || activate()"
      >
        <Loader2 v-if="state.loadingMore" :size="16" class="yayaw-feed-spin" aria-hidden="true" />
        {{ buttonText }}
      </button>
    </div>
    <p v-else-if="state.pages > 1" class="yayaw-feed-end" data-feed-end>{{ label("end") }}</p>
    <output class="yayaw-sr-only" aria-live="polite" data-feed-status>{{ announcement }}</output>
  </div>
</template>
