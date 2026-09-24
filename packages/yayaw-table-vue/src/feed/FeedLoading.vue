<script setup lang="ts">
import { computed, inject } from "vue";
import { tableContextKey } from "../context";
import { feedLabel } from "../feed-view";
import "./feed.css";

/**
 * The feed while its code or first page loads: skeleton posts in the feed's
 * column and the loading text for screen readers. As the async view's loading
 * component it gets no props and reads the table's locale and labels.
 */
const props = defineProps<{ label?: string }>();
const table = inject(tableContextKey, undefined);
const SKELETON_CARDS = ["a", "b", "c"];
const text = computed(
  () =>
    props.label ??
    feedLabel("loading", table?.locale ?? "en", (key, fallback) => {
      const value = (
        table?.translations.value as Record<string, unknown> | undefined
      )?.[`feed.${key}`];
      return typeof value === "string" ? value : fallback;
    })
);
</script>

<template>
  <div class="yayaw-feed-view" data-feed-view data-feed-loading>
    <output class="yayaw-sr-only">{{ text }}</output>
    <div class="yayaw-feed-skeleton" data-feed-skeleton>
      <div v-for="key in SKELETON_CARDS" :key="key" class="yayaw-feed-skeleton-card">
        <span class="yayaw-feed-skeleton-line" style="width: 66%; height: 1.25rem" />
        <span class="yayaw-feed-skeleton-line" style="width: 33%; height: 0.75rem" />
        <span class="yayaw-feed-skeleton-line" style="width: 100%; height: 3.5rem" />
      </div>
    </div>
  </div>
</template>
