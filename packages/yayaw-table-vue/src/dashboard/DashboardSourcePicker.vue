<script setup lang="ts">
import {
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot,
} from "reka-ui";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { errorText } from "./dashboard-composables";
import {
  type DashboardSourceChoice,
  dashboardSourceChoices,
} from "./dashboard-editor-model";
import type { DashboardTranslate } from "./dashboard-model";
import type {
  DashboardSourceLoader,
  DashboardSourceSummary,
} from "./dashboard-sources";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";

/**
 * The host's catalogue (`sources.list()`, the `tables` first), searchable
 * and grouped; unavailable sources are listed, disabled, with the reason.
 */
const props = defineProps<{
  loader: DashboardSourceLoader<DashboardTableSource>;
  label: DashboardLabel;
  locale: string;
  translate?: DashboardTranslate;
  /** The source picked so far (marked current). */
  value?: string;
  /** A source being loaded after it was picked. */
  picking?: string;
}>();
const emit = defineEmits<{ pick: [sourceId: string] }>();

type Listing =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; summaries: readonly DashboardSourceSummary[] };

const listing = ref<Listing>({ status: "loading" });
const query = ref("");
const root = ref<{ highlightItem: (value: string) => void }>();
let request = 0;
let unmounted = false;
onBeforeUnmount(() => {
  unmounted = true;
});
watch(
  () => props.loader,
  (loader) => {
    request += 1;
    const current = request;
    listing.value = { status: "loading" };
    loader
      .list()
      .then((summaries) => {
        if (unmounted || current !== request) return;
        listing.value = { status: "ready", summaries };
      })
      .catch((error: unknown) => {
        if (!unmounted && current === request) {
          listing.value = { status: "error", message: errorText(error) };
        }
      });
  },
  { immediate: true }
);
// Reka emits `select` for disabled items too: unavailable sources are never picked.
const choose = (source: DashboardSourceChoice): void => {
  if (source.available) emit("pick", source.id);
};
const groups = computed(() =>
  listing.value.status === "ready"
    ? dashboardSourceChoices(listing.value.summaries, {
        query: query.value,
        locale: props.locale,
        translate: props.translate,
      })
    : []
);
// The first source that can be picked is highlighted (Enter picks it), as the search changes.
const firstAvailable = computed(
  () => groups.value.flatMap((group) => group.sources).find((source) => source.available)?.id
);
watch(
  [firstAvailable, query],
  async ([id]) => {
    // After the filter's own highlight (on input), which the new list loses.
    await nextTick();
    if (id) root.value?.highlightItem(id);
  },
  { flush: "post" }
);
</script>

<template>
  <ListboxRoot ref="root" class="yayaw-dashboard-source-picker" data-source-picker="" highlight-on-hover>
    <ListboxFilter
      v-model="query"
      class="yayaw-input yayaw-dashboard-source-search"
      :aria-label="props.label('searchSources')"
      :placeholder="props.label('searchSources')"
      auto-focus
    />
    <ListboxContent class="yayaw-dashboard-source-list" :aria-label="props.label('chooseSource')">
      <output v-if="listing.status === 'loading'" class="yayaw-dashboard-source-state">{{ props.label("loadingSources") }}</output>
      <p v-else-if="listing.status === 'error'" class="yayaw-dashboard-source-state yayaw-dashboard-source-error" role="alert">
        {{ props.label("sourcesError", { error: listing.message }) }}
      </p>
      <p v-else-if="!groups.length" class="yayaw-dashboard-source-state">{{ props.label("noSources") }}</p>
      <ListboxGroup
        v-for="group in groups"
        :key="group.label || '-'"
        class="yayaw-dashboard-source-group"
        :data-source-group="group.label"
      >
        <ListboxGroupLabel v-if="group.label" class="yayaw-dashboard-source-heading">{{ group.label }}</ListboxGroupLabel>
        <ListboxItem
          v-for="source in group.sources"
          :key="source.id"
          class="yayaw-dashboard-source-option"
          :value="source.id"
          :disabled="!source.available"
          :aria-disabled="source.available ? undefined : 'true'"
          :data-source-id="source.id"
          :data-checked="source.id === props.value ? 'true' : undefined"
          @select="choose(source)"
        >
          <span class="yayaw-dashboard-source-text">
            <span class="yayaw-dashboard-source-name">{{ source.name }}</span>
            <span
              v-if="source.reason ?? source.description"
              class="yayaw-dashboard-source-detail"
              :data-source-reason="source.reason ? '' : undefined"
            >{{ source.reason ?? source.description }}</span>
          </span>
          <span v-if="props.picking === source.id" class="yayaw-dashboard-source-detail">
            {{ props.label("sourceLoading", { source: source.name }) }}
          </span>
        </ListboxItem>
      </ListboxGroup>
    </ListboxContent>
  </ListboxRoot>
</template>
