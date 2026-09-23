<script setup lang="ts">
import { computed } from "vue";
import { chartSettingFields, type ChartViewSettings } from "../chart-model";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";

const props = defineProps<{ context: DisplayModeSettingsContext }>();
const view = computed(() => props.context.settings as ChartViewSettings);
const fields = computed(() =>
  chartSettingFields({
    columns: props.context.columns,
    defaults: props.context.defaults as ChartViewSettings,
    view: view.value,
    locale: props.context.locale,
    translate: (key, fallback) => props.context.translate(`chart.${key}`, fallback),
    update: (next) => props.context.updateSettings(next),
  })
);
</script>

<template>
  <ViewSettingsPanel :fields="fields">
    <button
      type="button"
      class="yayaw-button yayaw-button-outline"
      :disabled="Object.keys(view).length === 0"
      @click="props.context.updateSettings(undefined)"
    >
      {{ props.context.translate("reset", "Reset") }}
    </button>
  </ViewSettingsPanel>
</template>
