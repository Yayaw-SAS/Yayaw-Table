<script setup lang="ts">
import { FileUp, RefreshCw, Upload } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, shallowRef, useId, useTemplateRef } from "vue";
import {
  applyImportField,
  canRunImport,
  createImportFlow,
  describeImportResult,
  type ImportFlowOptions,
  type ImportFlowState,
  type ImportSource,
  type ImportTranslate,
  importErrorLines,
  importFailureLines,
  importLabels,
  importMappingRows,
  importPreview,
  importRowCount,
  importSettingsFields,
  importSummaryLines,
} from "../../import-flow";
import type { ImportAdapters, ImportColumn, ImportRunResult } from "../../import-model";
import TableCheckbox from "../controls/TableCheckbox.vue";
import ColumnMapping from "./ColumnMapping.vue";

/**
 * Data › Import: a source (CSV file, pasted text or a host source), the
 * column mapping, a review, then progress and the result. The flow is shared
 * with the React edition; the host only writes rows.
 */
const props = defineProps<{
  columns: ImportColumn[];
  locale: string;
  translate: ImportTranslate;
  adapters: ImportAdapters;
  /** Offer CSV files and pasted text (default true). */
  csv?: boolean;
  sources?: Pick<ImportSource, "id" | "label" | "description">[];
  /** Connectors that can pull, listed with the sources ("From Notion"); they open their own screen. */
  connectorSources?: { id: string; label: string; description?: string }[];
  loadSource?: ImportFlowOptions["loadSource"];
  findExisting: ImportFlowOptions["findExisting"];
  batchSize?: number;
  allowNewOptions?: boolean;
}>();
const emit = defineEmits<{ done: []; imported: [result: ImportRunResult]; connector: [id: string] }>();
const id = useId();
// The table the screen was opened on owns the import; capture it once.
const opened = { columns: props.columns, locale: props.locale, allowNewOptions: props.allowNewOptions };
const t = importLabels(props.locale, props.translate);
const flow = createImportFlow({
  columns: opened.columns,
  locale: opened.locale,
  t,
  adapters: props.adapters,
  findExisting: props.findExisting,
  loadSource: props.loadSource,
  batchSize: props.batchSize,
  allowNewOptions: opened.allowNewOptions,
  onChange: (next) => {
    state.value = next;
  },
  onImported: (result) => emit("imported", result),
});
const state = shallowRef<ImportFlowState>(flow.state);
onBeforeUnmount(() => flow.dispose());

const pasted = ref("");
const fileInput = useTemplateRef<HTMLInputElement>("fileInput");
const dragging = ref(false);
const readFile = (file: File | undefined): void => {
  if (file) {
    flow.loadFile(file).catch(() => undefined);
  }
};
const onFile = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  readFile(input.files?.[0]);
  input.value = "";
};
const onDrop = (event: DragEvent): void => {
  dragging.value = false;
  readFile(event.dataTransfer?.files[0]);
};

const screen = { columns: opened.columns, locale: opened.locale, t, allowNewOptions: opened.allowNewOptions };
const settings = computed(() => importSettingsFields(state.value, { columns: opened.columns, t }));
const delimiterFields = computed(() => settings.value.filter((field) => field.id === "delimiter"));
const keyField = computed(() => settings.value.find((field) => field.id === "key"));
const rows = computed(() => importMappingRows(state.value, screen));
const preview = computed(() => ({ label: t("preview"), ...importPreview(state.value, screen) }));
const fileLine = computed(() => [state.value.sourceName, importRowCount(state.value, t)].filter(Boolean).join(" · "));
const summary = computed(() => (state.value.plan ? importSummaryLines(state.value.plan, state.value.skipErrors, t) : null));
const errorLines = computed(() =>
  state.value.plan ? importErrorLines(state.value.plan, { columns: opened.columns, t, hasHeaders: state.value.hasHeaders }) : []
);
const runnable = computed(() => (state.value.plan ? canRunImport(state.value.plan, state.value.skipErrors) : false));
const hasErrors = computed(() => (state.value.plan?.errorRows.length ?? 0) > 0);
const progress = computed(() => state.value.progress ?? { done: 0, total: 0 });
const progressText = computed(() => t("importing", progress.value));
const failures = computed(() =>
  state.value.result ? importFailureLines(state.value.result, { t, hasHeaders: state.value.hasHeaders }) : []
);
const change = (fieldId: string, value: string): void => applyImportField(flow, fieldId, value);
const review = (): void => {
  flow.review().catch(() => undefined);
};
const run = (): void => {
  flow.run().catch(() => undefined);
};
const loadSource = (sourceId: string): void => {
  flow.loadSource(sourceId).catch(() => undefined);
};
</script>

<template>
  <div class="yayaw-import-panel" data-import-panel>
    <div v-if="state.step === 'source'" class="yayaw-import-step" data-import-step="source">
      <div v-if="csv !== false" class="yayaw-import-step" data-import-csv>
        <button type="button" class="yayaw-import-drop" :class="{ 'yayaw-import-dragging': dragging }" data-import-drop
          @click="fileInput?.click()" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
          <FileUp :size="20" aria-hidden="true" class="yayaw-import-muted" />
          <span class="yayaw-import-strong">{{ t("sourceCsv") }}</span>
          <span class="yayaw-import-muted yayaw-import-small">{{ t("dropHint") }} · {{ t("sourceCsvHint") }}</span>
          <span class="yayaw-import-choose">{{ t("chooseFile") }}</span>
        </button>
        <input ref="fileInput" class="yayaw-sr-only" type="file" tabindex="-1" :aria-label="t('chooseFile')"
          accept=".csv,.tsv,.txt,text/csv,text/plain" @change="onFile" />
        <p v-if="state.loading" class="yayaw-schedule-loading"><span class="yayaw-spinner" aria-hidden="true" />{{ t("reading") }}</p>
        <div class="yayaw-import-paste">
          <label :for="`${id}-paste`">{{ t("pasteLabel") }}</label>
          <textarea :id="`${id}-paste`" v-model="pasted" class="yayaw-textarea yayaw-import-textarea" />
          <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!pasted.trim()" @click="flow.loadText(pasted)">
            {{ t("usePasted") }}
          </button>
        </div>
      </div>
      <div v-if="sources?.length || connectorSources?.length" class="yayaw-options-list">
        <h3 class="yayaw-setting-heading">{{ t("source") }}</h3>
        <button v-for="source in connectorSources ?? []" :key="`connector:${source.id}`" type="button" class="yayaw-options-item"
          :data-import-connector="source.id" @click="emit('connector', source.id)">
          <span class="yayaw-options-item-icon"><RefreshCw :size="16" aria-hidden="true" /></span>
          <span class="yayaw-options-item-copy"><span>{{ source.label }}</span><small v-if="source.description">{{ source.description }}</small></span>
        </button>
        <button v-for="source in sources ?? []" :key="source.id" type="button" class="yayaw-options-item" :disabled="state.loading"
          :data-import-source="source.id" @click="loadSource(source.id)">
          <span class="yayaw-options-item-icon"><Upload :size="16" aria-hidden="true" /></span>
          <span class="yayaw-options-item-copy"><span>{{ source.label }}</span><small v-if="source.description">{{ source.description }}</small></span>
        </button>
      </div>
      <p v-if="state.error" class="yayaw-connector-error" data-import-error role="alert">{{ state.error }}</p>
    </div>

    <div v-else-if="state.step === 'mapping'" class="yayaw-import-step" data-import-step="mapping">
      <ColumnMapping :before="delimiterFields" :rows="rows" :key-field="keyField" :preview="preview" @change="change">
        <template #intro>
          <p class="yayaw-import-muted yayaw-import-text" data-import-file>{{ fileLine }}</p>
          <label v-if="state.text !== null" class="yayaw-import-check">
            <TableCheckbox :model-value="state.hasHeaders" :label="t('headers')" @update:model-value="flow.setHasHeaders" />
            <span>{{ t("headers") }}</span>
          </label>
        </template>
        <template #after-key>
          <p class="yayaw-connector-hint">{{ t("keyHint") }}</p>
        </template>
        <p v-if="state.error" class="yayaw-connector-error" role="alert">{{ state.error }}</p>
        <div class="yayaw-schedule-actions">
          <button type="button" class="yayaw-button yayaw-button-outline" @click="flow.back()">{{ t("back") }}</button>
          <button type="button" class="yayaw-button" :disabled="state.loading" :aria-busy="state.loading" @click="review">
            <span v-if="state.loading" class="yayaw-spinner" aria-hidden="true" />{{ t("review") }}
          </button>
        </div>
      </ColumnMapping>
    </div>

    <div v-else-if="state.step === 'review' && state.plan" class="yayaw-import-step" data-import-step="review">
      <output class="yayaw-connector-summary" aria-live="polite" data-import-summary>
        <p v-if="summary?.creates" data-import-creates>{{ summary.creates }}</p>
        <p v-if="summary?.updates" data-import-updates>{{ summary.updates }}</p>
        <p v-if="summary?.errors" class="yayaw-connector-failure" data-import-errors>{{ summary.errors }}</p>
        <p v-for="line in errorLines" :key="line" class="yayaw-connector-failure yayaw-import-small">{{ line }}</p>
        <p v-if="!(summary?.creates || summary?.updates || summary?.errors)">{{ t("nothingToImport") }}</p>
      </output>
      <label v-if="hasErrors" class="yayaw-import-check">
        <TableCheckbox :model-value="state.skipErrors" :label="t('skipErrors')" @update:model-value="flow.setSkipErrors" />
        <span>{{ t("skipErrors") }}</span>
      </label>
      <p v-if="hasErrors && !state.skipErrors" class="yayaw-connector-hint">{{ t("errorsBlock") }}</p>
      <p v-if="state.error" class="yayaw-connector-error" role="alert">{{ state.error }}</p>
      <div class="yayaw-schedule-actions">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="flow.back()">{{ t("back") }}</button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('done')">{{ t("cancel") }}</button>
        <button type="button" class="yayaw-button yayaw-import-run" :disabled="!runnable" @click="run">
          <Upload :size="16" aria-hidden="true" />{{ t("import") }}
        </button>
      </div>
    </div>

    <div v-else-if="state.step === 'running'" class="yayaw-import-step" data-import-step="running">
      <p class="yayaw-import-text">{{ progressText }}</p>
      <div class="yayaw-import-progress" role="progressbar" :aria-label="progressText" :aria-valuemin="0"
        :aria-valuemax="progress.total" :aria-valuenow="progress.done">
        <div :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }" />
      </div>
      <button type="button" class="yayaw-button yayaw-button-outline" @click="flow.stop()">{{ t("stop") }}</button>
    </div>

    <div v-else-if="state.step === 'result' && state.result" class="yayaw-import-step" data-import-step="result">
      <output class="yayaw-connector-summary" aria-live="polite">
        <p class="yayaw-connector-counts" data-import-result>{{ describeImportResult(state.result, t) }}</p>
        <p v-for="line in failures" :key="line" class="yayaw-connector-failure">{{ line }}</p>
        <p v-if="state.result.aborted" class="yayaw-schedule-muted">{{ t("stopped") }}</p>
      </output>
      <div class="yayaw-schedule-actions">
        <button type="button" class="yayaw-button" @click="emit('done')">{{ t("done") }}</button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="flow.reset()">{{ t("another") }}</button>
      </div>
    </div>
  </div>
</template>
