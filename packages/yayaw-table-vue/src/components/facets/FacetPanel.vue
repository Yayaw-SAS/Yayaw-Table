<script setup lang="ts">
import { Check, X } from "lucide-vue-next";
import { reactive } from "vue";
import { useFacetPanel } from "../../composables/use-facets";
import {
  FACETS_MAX_ROWS,
  type FacetColumn,
  facetCountText,
  facetKeyTarget,
  facetSearchable,
  hasFacetSelection,
  visibleFacetEntries,
} from "../../facets-model";

/** The facets: one section per column, the counts' notices, "Clear all". */
const props = defineProps<{ headingId: string; closable?: boolean; sheet?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const panel = useFacetPanel();
const expanded = reactive<Record<string, boolean>>({});
const queries = reactive<Record<string, string>>({});
const visible = (facet: FacetColumn) =>
  visibleFacetEntries(panel.entriesOf(facet), {
    limit: facet.limit,
    expanded: expanded[facet.id],
    query: queries[facet.id],
  });
const moveFocus = (event: KeyboardEvent, index: number): void => {
  const buttons = [
    ...((event.currentTarget as HTMLElement)
      .closest("[data-facet-values]")
      ?.querySelectorAll<HTMLButtonElement>("button[data-facet-value]") ?? []),
  ];
  const target = facetKeyTarget(event.key, index, buttons.length);
  if (target !== undefined) {
    event.preventDefault();
    buttons[target]?.focus();
  }
};
</script>

<template>
  <div v-if="panel.facets.value" class="yayaw-facets" data-facet-panel-content="">
    <div class="yayaw-facets-header">
      <h2 :id="props.headingId" :class="sheet ? 'yayaw-sr-only' : 'yayaw-facets-title'">{{ panel.label("title") }}</h2>
      <div class="yayaw-facets-actions">
        <button v-if="panel.selectedCount.value" type="button" class="yayaw-button yayaw-button-ghost yayaw-facets-clear-all" data-facet-clear-all="" @click="panel.clearAll()">{{ panel.label("clearAll") }}</button>
        <button v-if="closable" type="button" class="yayaw-icon-button" :aria-label="panel.label('close')" @click="emit('close')"><X :size="16" aria-hidden="true" /></button>
      </div>
    </div>
    <p v-if="panel.facets.value.columns.some((facet) => panel.blocked(facet))" class="yayaw-facets-notice" data-facet-notice="or">{{ panel.label("anyJoin") }}</p>
    <p v-if="panel.truncated.value" class="yayaw-facets-notice" data-facet-notice="truncated">{{ panel.label("truncated", { count: FACETS_MAX_ROWS.toLocaleString(panel.locale) }) }}</p>
    <div v-if="panel.error.value" class="yayaw-facets-error" role="alert">
      <span>{{ panel.label("error") }}</span>
      <button type="button" class="yayaw-button yayaw-button-outline" @click="panel.retry()">{{ panel.label("retry") }}</button>
    </div>
    <output class="yayaw-sr-only" aria-live="polite">{{ panel.loading.value ? panel.label("loading") : "" }}</output>
    <section v-for="facet in panel.facets.value.columns" :key="facet.id" class="yayaw-facet" :data-facet="facet.id" :aria-labelledby="`${props.headingId}-${facet.id}`">
      <div class="yayaw-facet-header">
        <h3 :id="`${props.headingId}-${facet.id}`" class="yayaw-facet-title">{{ facet.label }}</h3>
        <button v-if="hasFacetSelection(panel.selection(facet))" type="button" class="yayaw-facet-clear" data-facet-clear="" :aria-label="panel.label('clearFacet', { facet: facet.label })" @click="panel.clear(facet)">{{ panel.label("clear") }}</button>
      </div>
      <input v-if="facetSearchable(panel.entriesOf(facet), facet.limit)" v-model="queries[facet.id]" type="search" class="yayaw-input yayaw-facet-search" data-facet-search="" :aria-label="panel.label('search', { facet: facet.label })" :placeholder="panel.label('search', { facet: facet.label })" />
      <ul class="yayaw-facet-values" data-facet-values="" :aria-labelledby="`${props.headingId}-${facet.id}`">
        <li v-for="(entry, index) in visible(facet).entries" :key="entry.key">
          <button type="button" class="yayaw-facet-value" :aria-pressed="entry.selected" :data-facet-value="entry.empty ? '' : String(entry.value)" :data-facet-empty="entry.empty ? '' : undefined" :disabled="panel.blocked(facet)" :title="entry.detail ? `${entry.label} · ${entry.detail}` : entry.label" @click="panel.toggle(facet, entry.value)" @keydown="moveFocus($event, index)">
            <span class="yayaw-facet-check" aria-hidden="true"><Check v-if="entry.selected" :size="12" /></span>
            <span class="yayaw-facet-label">
              <span :class="{ 'yayaw-facet-empty': entry.empty }">{{ entry.label }}</span>
              <small v-if="entry.detail">{{ entry.detail }}</small>
            </span>
            <template v-if="panel.facets.value.showCounts && entry.count !== undefined">
              <span class="yayaw-facet-count" data-facet-count="" aria-hidden="true">{{ entry.count.toLocaleString(panel.locale) }}</span>
              <span class="yayaw-sr-only">, {{ facetCountText(entry.count, panel.locale, panel.translate) }}</span>
            </template>
          </button>
        </li>
      </ul>
      <p v-if="!visible(facet).entries.length && !panel.loading.value" class="yayaw-facets-notice">{{ panel.label("noMatches") }}</p>
      <button v-if="visible(facet).hidden > 0 || expanded[facet.id]" type="button" class="yayaw-facet-more" data-facet-more="" @click="expanded[facet.id] = !expanded[facet.id]">
        {{ expanded[facet.id] ? panel.label("showLess") : panel.label("showMore", { count: visible(facet).hidden }) }}
      </button>
    </section>
  </div>
</template>
