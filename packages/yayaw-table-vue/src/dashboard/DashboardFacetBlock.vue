<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { FacetCounts } from "../facets-model";
import {
  type FacetBlockOptions,
  facetBlockColumn,
  facetBlockEntries,
  facetBlockLabel,
  facetBlockProps,
  loadFacetBlockCounts,
  toggleFacetBlockValue,
} from "./dashboard-facets";
import type {
  DashboardFilterValue,
  DashboardSetFilterResult,
} from "./dashboard-model";
import type { DashboardJsonObject } from "./dashboard-schema";

/**
 * A column's values with their numbers of records under the screen's other
 * filters; a click sets the screen filter (`setFilter`), so the widgets it
 * targets (a full-page table…) follow.
 */
const props = defineProps<{
  options: FacetBlockOptions;
  widgetId: string;
  props: DashboardJsonObject;
  size?: { w: number; h: number };
  editing?: boolean;
  locale: string;
  revision: number;
  filters: Readonly<Record<string, DashboardFilterValue | undefined>>;
  refresh?: (tableId?: string) => void;
  setFilter: (filterId: string, value: unknown) => DashboardSetFilterResult;
  filterRules: (
    tableId: string,
    options?: { exclude?: readonly string[] }
  ) => Record<string, unknown>[];
}>();
const settings = computed(() => facetBlockProps(props.props, props.options));
const column = computed(() => facetBlockColumn(props.options.column, props.locale));
const rulesKey = computed(() =>
  JSON.stringify(props.filterRules(props.options.tableId, { exclude: [settings.value.filterId] }))
);
const counts = ref<FacetCounts>();
const status = ref<"error" | "loading" | "ready">("loading");
const refusal = ref<string>();
let controller: AbortController | undefined;
watch(
  [column, rulesKey, () => props.revision, () => props.locale],
  () => {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    status.value = "loading";
    loadFacetBlockCounts({
      actions: props.options.actions,
      column: column.value,
      rules: JSON.parse(rulesKey.value) as Record<string, unknown>[],
      locale: props.locale,
      signal: current.signal,
    })
      .then((loaded) => {
        if (!current.signal.aborted) {
          counts.value = loaded;
          status.value = "ready";
        }
      })
      .catch(() => {
        if (!current.signal.aborted) status.value = "error";
      });
  },
  { immediate: true }
);
onBeforeUnmount(() => controller?.abort());
const selected = computed(() => props.filters[settings.value.filterId]);
const chosen = computed(() => Array.isArray(selected.value) && selected.value.length > 0);
const entries = computed(() =>
  facetBlockEntries(column.value, { counts: counts.value, selected: selected.value, locale: props.locale })
);
const set = (value: unknown): void => {
  const result = props.setFilter(settings.value.filterId, value);
  refusal.value = result.ok ? undefined : result.message;
};
</script>

<template>
  <div class="yayaw-facet-block" :data-facet-block="settings.filterId" :data-layout="settings.layout">
    <ul class="yayaw-facet-block-values">
      <li>
        <button type="button" class="yayaw-facet-block-value" data-facet-all="" :aria-pressed="!chosen" @click="set(undefined)">{{ facetBlockLabel("facetAll", props.locale) }}</button>
      </li>
      <li v-for="entry in entries" :key="entry.key">
        <button type="button" class="yayaw-facet-block-value" :data-facet-value="String(entry.value)" :aria-pressed="entry.selected" @click="set(toggleFacetBlockValue(selected, String(entry.value)))">
          <Check v-if="entry.selected && settings.layout !== 'chips'" :size="14" aria-hidden="true" />
          <span class="yayaw-facet-block-label">{{ entry.label }}</span>
          <span v-if="settings.showCounts && entry.count !== undefined" class="yayaw-facet-block-count" data-facet-count="">{{ entry.count.toLocaleString(props.locale) }}</span>
        </button>
      </li>
    </ul>
    <p v-if="status === 'loading' && !counts" class="yayaw-dashboard-muted">{{ facetBlockLabel("facetLoading", props.locale) }}</p>
    <p v-if="status === 'error'" class="yayaw-facet-block-error" role="alert">{{ facetBlockLabel("facetError", props.locale) }}</p>
    <p v-if="status === 'ready' && !entries.length" class="yayaw-dashboard-muted">{{ facetBlockLabel("facetEmpty", props.locale) }}</p>
    <p v-if="refusal" class="yayaw-facet-block-error" role="alert">{{ refusal }}</p>
  </div>
</template>
