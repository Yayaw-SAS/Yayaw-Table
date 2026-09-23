<script setup lang="ts">
import { Download } from "lucide-vue-next";
import { computed, ref, useId } from "vue";
import type { ExportFormat, ExportSettings } from "../../export-model";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";

/** Format, records, columns, values and file name, then Export. */
const props = defineProps<{
  busy: boolean;
  defaultFileName: string;
  formats: ExportFormat[];
  label: (key: string, fallback: string) => string;
  selectedCount: number;
}>();
const emit = defineEmits<{ export: [settings: ExportSettings] }>();
const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", xlsx: "Excel (.xlsx)", pdf: "PDF" };
const id = useId();
const settings = ref<ExportSettings>({
  format: props.formats[0] ?? "csv",
  scope: props.selectedCount > 0 ? "selection" : "view",
  columns: "visible",
  values: "formatted",
  fileName: props.defaultFileName,
});
const scope = computed(() => (props.selectedCount > 0 ? settings.value.scope : "view"));
const fields = computed(() => [
  {
    id: "format",
    label: props.label("format", "Format"),
    value: settings.value.format,
    options: props.formats.map((format) => ({
      value: format,
      label: format === "pdf" ? props.label("pdf", "PDF (print)") : FORMAT_LABELS[format],
    })),
    onChange: (value: string) => (settings.value.format = value as ExportFormat),
  },
  {
    id: "scope",
    label: props.label("scope", "Records"),
    value: scope.value,
    options: [
      { value: "view", label: props.label("scopeView", "All in this view") },
      ...(props.selectedCount > 0
        ? [{ value: "selection", label: props.label("scopeSelection", "Selected ({count})").replace("{count}", String(props.selectedCount)) }]
        : []),
    ],
    onChange: (value: string) => (settings.value.scope = value === "selection" ? "selection" : "view"),
  },
  {
    id: "columns",
    label: props.label("columns", "Columns"),
    value: settings.value.columns,
    options: [
      { value: "visible", label: props.label("columnsVisible", "Visible") },
      { value: "all", label: props.label("columnsAll", "All") },
    ],
    onChange: (value: string) => (settings.value.columns = value === "all" ? "all" : "visible"),
  },
  {
    id: "values",
    label: props.label("values", "Values"),
    value: settings.value.values,
    options: [
      { value: "formatted", label: props.label("valuesFormatted", "As displayed") },
      { value: "raw", label: props.label("valuesRaw", "Raw") },
    ],
    onChange: (value: string) => (settings.value.values = value === "raw" ? "raw" : "formatted"),
  },
]);
</script>

<template>
  <div class="yayaw-export-panel" data-export-panel>
    <ViewSettingsPanel :fields="fields">
      <div class="yayaw-control-field yayaw-export-name">
        <label :for="id">{{ label("fileName", "File name") }}</label>
        <input :id="id" v-model="settings.fileName" class="yayaw-input" />
      </div>
      <button type="button" class="yayaw-button yayaw-export-run" :disabled="busy" :aria-busy="busy"
        @click="emit('export', { ...settings, scope })">
        <span v-if="busy" class="yayaw-spinner" aria-hidden="true" />
        <Download v-else :size="16" aria-hidden="true" />
        {{ label("run", "Export") }}
      </button>
    </ViewSettingsPanel>
  </div>
</template>
