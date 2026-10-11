<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { ChevronDown, Plus } from "lucide-vue-next";
import {
  detailValue,
  loadRelatedRecords,
  relatedRowKey,
  relatedView,
  type DetailLabels,
  type DetailRecord,
  type DetailRelatedActionEvent,
  type DetailRelatedLoader,
  type DetailRelatedSection,
} from "../../record-details";
import DetailValue from "./DetailValue.vue";
import "../../record-details.css";

const props = defineProps<{
  section: DetailRelatedSection;
  row: DetailRecord;
  labels: DetailLabels;
  locale: string;
  loadRelated?: DetailRelatedLoader;
  onRelatedAction?: (event: DetailRelatedActionEvent) => void;
}>();
type RelatedState =
  | { status: "idle" | "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; rows: DetailRecord[] };
const id = useId();
const element = ref<HTMLElement>();
const open = ref(props.section.collapsed !== true);
const seen = ref(false);
const state = ref<RelatedState>({ status: "idle" });
let request = 0;
let observer: IntersectionObserver | undefined;
const load = async (): Promise<void> => {
  request += 1;
  const current = request;
  state.value = { status: "loading" };
  try {
    const rows = await loadRelatedRecords(props.section, props.row, props.loadRelated);
    if (request === current) state.value = { status: "loaded", rows };
  } catch (cause) {
    if (request === current) {
      state.value = { status: "error", error: cause instanceof Error && cause.message ? cause.message : props.labels.relatedError };
    }
  }
};
// Records load once the section is open and on screen; immediately without IntersectionObserver.
const watchVisibility = (): void => {
  if (seen.value || !open.value) return;
  if (!(element.value && typeof IntersectionObserver === "function")) {
    seen.value = true;
    return;
  }
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      seen.value = true;
      observer?.disconnect();
    }
  });
  observer.observe(element.value);
};
onMounted(watchVisibility);
watch(open, watchVisibility);
watch(() => open.value && seen.value && state.value.status === "idle", (shouldLoad) => {
  if (shouldLoad) load().catch(() => undefined);
}, { immediate: true });
onBeforeUnmount(() => {
  request += 1;
  observer?.disconnect();
});
const view = computed(() => state.value.status === "loaded" ? relatedView(props.section, state.value.rows) : undefined);
const hidden = computed(() => view.value ? view.value.total - view.value.rows.length : 0);
const showOpen = computed(() => Boolean(props.section.open && props.onRelatedAction));
const act = (kind: "open" | "add", related?: DetailRecord): void => {
  const action = props.section[kind];
  if (!(action && props.onRelatedAction)) return;
  props.onRelatedAction({ action: action.action, kind, section: props.section, row: props.row, related });
};
</script>

<template>
  <section ref="element" class="yayaw-detail-section yayaw-detail-related" :data-related-section="section.id" :aria-labelledby="`${id}-title`">
    <div class="yayaw-detail-related-header">
      <h3 :id="`${id}-title`">
        <button type="button" :aria-expanded="open" :aria-controls="`${id}-body`" @click="open = !open">
          <ChevronDown :size="14" aria-hidden="true" />{{ section.title }}<span v-if="view" class="yayaw-detail-count">{{ view.total }}</span>
        </button>
      </h3>
      <button v-if="section.add && onRelatedAction" type="button" class="yayaw-detail-related-button" @click="act('add')"><Plus :size="13" aria-hidden="true" />{{ section.add.label ?? labels.add }}</button>
    </div>
    <p v-if="section.description" class="yayaw-detail-description">{{ section.description }}</p>
    <div :id="`${id}-body`" class="yayaw-detail-related-body" :hidden="!open">
      <output v-if="state.status === 'loading' || state.status === 'idle'" class="yayaw-detail-related-status">{{ labels.relatedLoading }}</output>
      <div v-else-if="state.status === 'error'" class="yayaw-detail-related-status" role="alert">
        <span>{{ state.error }}</span>
        <button type="button" class="yayaw-detail-related-button" @click="load().catch(() => undefined)">{{ labels.retry }}</button>
      </div>
      <p v-else-if="view && view.total === 0" class="yayaw-detail-empty">{{ section.empty ?? labels.relatedEmpty }}</p>
      <template v-else-if="view">
        <table class="yayaw-detail-related-table">
          <thead>
            <tr>
              <th v-for="column in section.columns" :key="column.id" scope="col">{{ column.label }}</th>
              <th v-if="showOpen" scope="col"><span class="yayaw-sr-only">{{ section.open?.label ?? labels.open }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(related, index) in view.rows" :key="relatedRowKey(related, index)">
              <td v-for="column in section.columns" :key="column.id"><DetailValue :field="column" :value="detailValue(related, column)" :row="related" :locale="locale" :labels="labels" /></td>
              <td v-if="showOpen"><button type="button" class="yayaw-detail-related-button" @click="act('open', related)">{{ section.open?.label ?? labels.open }}</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="hidden > 0" class="yayaw-detail-related-more">{{ labels.relatedMore.replaceAll("{count}", String(hidden)) }}</p>
      </template>
    </div>
  </section>
</template>
