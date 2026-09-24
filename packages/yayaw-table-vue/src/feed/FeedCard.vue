<script setup lang="ts">
import { FileText } from "lucide-vue-next";
import { computed, useId } from "vue";
import {
  type FeedBodyRenderer,
  type FeedColumn,
  type FeedLabelKey,
  feedAuthor,
  feedBodyText,
  feedDate,
  feedPropertyValue,
  feedRowMedia,
  feedTitleText,
  feedValue,
  type ResolvedFeedSettings,
} from "../feed-view";
import type { TableGalleryMediaConfig } from "../media-contract";
import FeedBody from "./FeedBody.vue";

type RowRecord = Record<string, unknown>;

const props = defineProps<{
  row: RowRecord;
  rowId: string;
  columns: Map<string, FeedColumn>;
  settings: ResolvedFeedSettings;
  locale: string;
  coloredTags: boolean;
  label: (key: FeedLabelKey, params?: Record<string, number | string>) => string;
  renderBody?: FeedBodyRenderer;
  now: Date;
  position: number;
  setSize: number;
  /** "Show more" state, kept by the view per row id so it survives windowing. */
  expanded: boolean;
  /** `table.gallery.media` and image column: the media contract of the table. */
  gallery?: TableGalleryMediaConfig;
  imageColumn?: string;
}>();
const emit = defineEmits<{
  open: [row: RowRecord, event: MouseEvent];
  toggle: [rowId: string];
}>();

const titleId = useId();
const column = (id?: string) => (id ? props.columns.get(id) : undefined);
const title = computed(
  () =>
    feedTitleText(props.row, column(props.settings.titleColumn), props.locale) ||
    props.label("untitled")
);
const dateColumn = computed(() => column(props.settings.dateColumn));
const date = computed(() =>
  dateColumn.value
    ? feedDate(
        feedValue(props.row, dateColumn.value),
        props.settings.dateDisplay,
        props.locale,
        dateColumn.value,
        props.now
      )
    : undefined
);
const author = computed(() =>
  feedAuthor(feedValue(props.row, column(props.settings.authorColumn)))
);
const bodyColumn = computed(() => column(props.settings.bodyColumn));
const bodyValue = computed(() => feedValue(props.row, bodyColumn.value));
const bodyText = computed(() => feedBodyText(bodyValue.value));
const hasRendered = computed(
  () => Boolean(bodyColumn.value && props.renderBody && bodyText.value)
);
const rendered = computed(() =>
  hasRendered.value ? props.renderBody?.(bodyValue.value, props.row) : undefined
);
const mediaColumn = computed(() => column(props.settings.mediaColumn));
const media = computed(() =>
  feedRowMedia(props.row, mediaColumn.value, props.gallery, props.imageColumn)
);
const properties = computed(() =>
  props.settings.propertyColumnIds.flatMap((id) => {
    const item = column(id);
    const value =
      item &&
      feedPropertyValue(item, feedValue(props.row, item), {
        locale: props.locale,
        coloredTags: props.coloredTags,
        yes: props.label("yes"),
        no: props.label("no"),
      });
    return item && value ? [{ column: item, value }] : [];
  })
);
</script>

<template>
  <article
    class="yayaw-feed-card"
    :aria-labelledby="titleId"
    :aria-posinset="props.position"
    :aria-setsize="props.setSize"
    data-feed-card
    data-feed-item
    :data-row-id="props.rowId"
  >
    <header class="yayaw-feed-header">
      <h3 :id="titleId" class="yayaw-feed-title">
        <button type="button" data-feed-title @click="emit('open', props.row, $event)">
          {{ title }}
        </button>
      </h3>
      <div v-if="author || date" class="yayaw-feed-byline" data-feed-byline>
        <span v-if="author" class="yayaw-feed-author" data-feed-author>
          <img
            v-if="author.avatarUrl"
            class="yayaw-feed-avatar"
            :src="author.avatarUrl"
            alt=""
            width="24"
            height="24"
            loading="lazy"
            decoding="async"
          />
          <span v-else class="yayaw-feed-avatar yayaw-feed-initials" aria-hidden="true">{{ author.initials }}</span>
          <span class="yayaw-feed-author-name"><span class="yayaw-sr-only">{{ `${props.label("by")} ` }}</span>{{ author.name }}</span>
        </span>
        <span v-if="author && date" aria-hidden="true">·</span>
        <time
          v-if="date"
          class="yayaw-feed-date"
          data-feed-date
          :data-feed-date-column="dateColumn?.id"
          :datetime="date.dateTime"
          :title="date.title"
        >{{ date.text }}</time>
      </div>
    </header>
    <FeedBody
      v-if="bodyText"
      :text="bodyText"
      :lines="props.settings.bodyLines"
      :content="rendered"
      :has-content="hasRendered"
      :show-more="props.label('showMore')"
      :show-less="props.label('showLess')"
      :expanded="props.expanded"
      @toggle="emit('toggle', props.rowId)"
    />
    <div
      v-if="media.images.length || media.videos.length || media.files.length"
      class="yayaw-feed-media"
      data-feed-media
    >
      <ul
        v-if="media.images.length"
        class="yayaw-feed-images"
        :data-count="media.images.length > 1 ? 'many' : 'one'"
        :aria-label="props.label('media', { title })"
      >
        <li v-for="(image, index) in media.images" :key="image.url">
          <!-- Lazy, decoded off the main thread, in a box of fixed ratio: no layout shift. -->
          <img
            :src="image.url"
            :alt="image.alt"
            width="720"
            :height="media.images.length > 1 ? 360 : 450"
            loading="lazy"
            decoding="async"
          />
          <span
            v-if="media.moreImages > 0 && index === media.images.length - 1"
            class="yayaw-feed-more-images"
          >{{ props.label("moreImages", { count: media.moreImages }) }}</span>
        </li>
      </ul>
      <!-- The poster stands for the video: nothing loads beyond metadata before it plays. -->
      <video
        v-for="video in media.videos"
        :key="video.url"
        class="yayaw-feed-video"
        data-feed-video
        controls
        playsinline
        width="720"
        height="405"
        :poster="video.poster"
        :preload="video.poster ? 'none' : 'metadata'"
        :aria-label="video.alt || props.label('video', { title })"
      >
        <source :src="video.url" :type="video.mimeType" />
        <track
          v-for="track in video.tracks"
          :key="`${track.srcLang ?? ''}:${track.src}`"
          :kind="track.kind"
          :label="track.label"
          :src="track.src"
          :srclang="track.srcLang"
        />
      </video>
      <ul v-if="media.files.length" class="yayaw-feed-files">
        <li v-for="file in media.files" :key="`${file.name}:${file.url ?? ''}`">
          <FileText :size="14" aria-hidden="true" />
          <a v-if="file.url" :href="file.url" target="_blank" rel="noopener noreferrer">{{ file.name }}</a>
          <span v-else>{{ file.name }}</span>
        </li>
      </ul>
    </div>
    <dl v-if="properties.length" class="yayaw-feed-properties" data-feed-properties>
      <div
        v-for="item in properties"
        :key="item.column.id"
        class="yayaw-feed-property"
        :data-feed-property="item.column.id"
      >
        <dt :class="{ 'yayaw-sr-only': !props.settings.showPropertyLabels }">{{ item.column.header ?? item.column.id }}</dt>
        <dd>
          <span v-if="item.value.kind === 'tags'" class="yayaw-feed-tags">
            <span
              v-for="tag in item.value.tags"
              :key="tag.id"
              class="yayaw-tag yayaw-feed-tag"
              :class="tag.className"
              :data-colored="tag.colored"
              :data-custom-color="tag.className ? '' : undefined"
              :style="tag.style"
            >{{ tag.text }}</span>
          </span>
          <a
            v-else-if="item.value.kind === 'link'"
            :href="item.value.href"
            target="_blank"
            rel="noopener noreferrer"
          >{{ item.value.text }}</a>
          <span v-else>{{ item.value.text }}</span>
        </dd>
      </div>
    </dl>
  </article>
</template>
