<script setup lang="ts">
import { Download } from "lucide-vue-next";
import { computed, ref, useId } from "vue";
import type { ExportColumnChoice, ExportFormat, ExportSettings, ExportT } from "../../export-model";
import TableCheckbox from "../controls/TableCheckbox.vue";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";

/** Format, records, columns, values and file name, then Export. */
const props = defineProps<{
  busy: boolean;
  /** The exportable columns in display order; the visible ones start checked. */
  columns: ExportColumnChoice[];
  defaultFileName: string;
  formats: ExportFormat[];
  label: ExportT;
  selectedCount: number;
}>();
const emit = defineEmits<{ export: [settings: ExportSettings] }>();
const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", xlsx: "Excel (.xlsx)", pdf: "PDF" };
const id = useId();
const hintId = `${id}-hint`;
const settings = ref<ExportSettings>({
  format: props.formats[0] ?? "csv",
  scope: props.selectedCount > 0 ? "selection" : "view",
  columns: "visible",
  columnIds: props.columns.filter((column) => column.visible).map((column) => column.id),
  values: "formatted",
  fileName: props.defaultFileName,
});
const scope = computed(() => (props.selectedCount > 0 ? settings.value.scope : "view"));
const custom = computed(() => settings.value.columns === "custom");
const chosen = computed(() => new Set(settings.value.columnIds));
const noColumns = computed(() => custom.value && chosen.value.size === 0);
// The checklist keeps the display order whatever the order of the clicks.
const toggle = (columnId: string, on: boolean): void => {
  settings.value.columnIds = props.columns
    .filter((column) => (column.id === columnId ? on : chosen.value.has(column.id)))
    .map((column) => column.id);
};
const fields = computed(() => [
  {
    id: "format",
    label: props.label("format"),
    value: settings.value.format,
    options: props.formats.map((format) => ({
      value: format,
      label: format === "pdf" ? props.label("pdf") : FORMAT_LABELS[format],
    })),
    onChange: (value: string) => (settings.value.format = value as ExportFormat),
  },
  {
    id: "scope",
    label: props.label("scope"),
    value: scope.value,
    options: [
      { value: "view", label: props.label("scopeView") },
      ...(props.selectedCount > 0
        ? [{ value: "selection", label: props.label("scopeSelection", { count: props.selectedCount }) }]
        : []),
    ],
    onChange: (value: string) => (settings.value.scope = value === "selection" ? "selection" : "view"),
  },
  {
    id: "columns",
    label: props.label("columns"),
    value: settings.value.columns,
    options: [
      { value: "visible", label: props.label("columnsVisible") },
      { value: "all", label: props.label("columnsAll") },
      { value: "custom", label: props.label("columnsCustom") },
    ],
    onChange: (value: string) =>
      (settings.value.columns = value === "all" || value === "custom" ? value : "visible"),
  },
  {
    id: "values",
    label: props.label("values"),
    value: settings.value.values,
    options: [
      { value: "formatted", label: props.label("valuesFormatted") },
      { value: "raw", label: props.label("valuesRaw") },
    ],
    onChange: (value: string) => (settings.value.values = value === "raw" ? "raw" : "formatted"),
  },
]);
</script>

<template>
  <div class="yayaw-export-panel" data-export-panel>
    <ViewSettingsPanel :fields="fields">
      <template #after-columns>
        <fieldset v-if="custom" class="yayaw-settings-choices yayaw-export-columns" data-export-columns>
          <legend class="yayaw-sr-only">{{ label("columnsChoice") }}</legend>
          <div class="yayaw-export-columns-actions">
            <button type="button" class="yayaw-button yayaw-button-outline"
              @click="settings.columnIds = columns.map((column) => column.id)">{{ label("columnsSelectAll") }}</button>
            <button type="button" class="yayaw-button yayaw-button-outline" @click="settings.columnIds = []">
              {{ label("columnsSelectNone") }}
            </button>
          </div>
          <label v-for="column in columns" :key="column.id" class="yayaw-settings-choice">
            <TableCheckbox :model-value="chosen.has(column.id)" :label="column.header"
              @update:model-value="toggle(column.id, $event)" /><span>{{ column.header }}</span>
          </label>
          <output :id="hintId" class="yayaw-export-hint">{{ noColumns ? label("columnsEmpty") : "" }}</output>
        </fieldset>
      </template>
      <div class="yayaw-control-field yayaw-export-name">
        <label :for="id">{{ label("fileName") }}</label>
        <input :id="id" v-model="settings.fileName" class="yayaw-input" />
      </div>
      <button type="button" class="yayaw-button yayaw-export-run" :disabled="busy || noColumns" :aria-busy="busy"
        :aria-describedby="noColumns ? hintId : undefined" @click="emit('export', { ...settings, scope })">
        <span v-if="busy" class="yayaw-spinner" aria-hidden="true" />
        <Download v-else :size="16" aria-hidden="true" />
        {{ label("run") }}
      </button>
    </ViewSettingsPanel>
  </div>
</template>
