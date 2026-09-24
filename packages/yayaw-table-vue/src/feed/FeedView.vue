<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import TableEmptyState from "../components/table/TableEmptyState.vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import {
  type FeedColumn,
  type FeedLabelKey,
  type FeedViewSettings,
  feedBodyRenderer,
  feedLabel,
  groupFeedRows,
  resolveFeedSettings,
} from "../feed-view";
import FeedCard from "./FeedCard.vue";
import { useFeedPages } from "./use-feed-pages";
import "../tag-colors.css";
import "./feed.css";

const props = defineProps<{ context: DisplayModeRenderContext }>();

const SKELETON_CARDS = ["a", "b", "c"];
/** Start loading the next page a little before the end scrolls into view. */
const INFINITE_SCROLL_MARGIN = "240px";

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
// Relative dates read against the time the rows arrived.
const now = ref(new Date());
watch(feed.rows, () => {
  now.value = new Date();
});
const sections = computed(() =>
  groupFeedRows(
    feed.rows.value,
    props.context.groupBy
      ? columnMap.value.get(props.context.groupBy)
      : undefined,
    label("noValue")
  )
);
const positions = computed(
  () => new Map(feed.rows.value.map((row, index) => [row, index + 1]))
);
const renderBody = computed(() => feedBodyRenderer(props.context.defaults));

// The button stays as the accessible way to load more, also with infinite scroll.
const sentinel = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
watch(
  [sentinel, () => settings.value.infiniteScroll, feed.hasMore, feed.loadingMore],
  () => {
    observer?.disconnect();
    observer = undefined;
    const element = sentinel.value;
    if (
      !(settings.value.infiniteScroll && feed.hasMore.value && element) ||
      feed.loadingMore.value ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          feed.loadMore();
        }
      },
      { rootMargin: INFINITE_SCROLL_MARGIN }
    );
    observer.observe(element);
  },
  { flush: "post" }
);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div
    v-if="feed.loading.value && feed.rows.value.length === 0"
    class="yayaw-feed-view"
    data-feed-view
  >
    <output class="yayaw-sr-only">{{ label("loading") }}</output>
    <div class="yayaw-feed-skeleton" data-feed-skeleton>
      <div v-for="key in SKELETON_CARDS" :key="key" class="yayaw-feed-skeleton-card">
        <span class="yayaw-feed-skeleton-line" style="width: 66%; height: 1.25rem" />
        <span class="yayaw-feed-skeleton-line" style="width: 33%; height: 0.75rem" />
        <span class="yayaw-feed-skeleton-line" style="width: 100%; height: 3.5rem" />
      </div>
    </div>
  </div>
  <div
    v-else-if="feed.error.value && feed.rows.value.length === 0"
    class="yayaw-feed-view yayaw-feed-failed"
    data-feed-view
  >
    <p class="yayaw-feed-error" role="alert">{{ label("error") }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline" @click="feed.retry()">
      {{ label("retry") }}
    </button>
  </div>
  <div v-else-if="feed.rows.value.length === 0" class="yayaw-feed-view" data-feed-view>
    <TableEmptyState />
  </div>
  <div v-else class="yayaw-feed-view" :data-density="settings.density" data-feed-view>
    <div
      class="yayaw-feed-list"
      role="feed"
      :aria-busy="feed.loading.value || feed.loadingMore.value"
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
        <FeedCard
          v-for="row in section.rows"
          :key="props.context.getRowId(row)"
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
          :set-size="feed.hasMore.value ? -1 : feed.rows.value.length"
          @open="(row, event) => props.context.openRow(row, event)"
        />
      </section>
    </div>
    <p v-if="feed.error.value" class="yayaw-feed-error" role="alert">{{ label("error") }}</p>
    <div v-if="feed.hasMore.value" ref="sentinel" class="yayaw-feed-footer" data-feed-footer>
      <button
        type="button"
        class="yayaw-button yayaw-button-outline"
        :disabled="feed.loadingMore.value"
        :aria-busy="feed.loadingMore.value"
        @click="feed.loadMore()"
      >
        <Loader2 v-if="feed.loadingMore.value" :size="16" class="yayaw-feed-spin" aria-hidden="true" />
        {{ feed.loadingMore.value ? label("loadingMore") : label("loadMore") }}
      </button>
    </div>
  </div>
</template>
