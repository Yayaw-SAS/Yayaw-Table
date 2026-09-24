<script setup lang="ts">
import { computed } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import {
  type MapTableConfig,
  type MapViewSettings,
  mapSettingFields,
} from "../map-model";

/** View → Card settings of the map: columns, popup, clusters, basemap, start view. */
const props = defineProps<{ context: DisplayModeSettingsContext }>();
const view = computed(() => props.context.settings as MapViewSettings);
const panel = computed(() =>
  mapSettingFields({
    tableId: props.context.tableId,
    columns: props.context.columns,
    defaults: props.context.defaults as MapTableConfig,
    view: view.value,
    locale: props.context.locale,
    translate: (key, fallback) => props.context.translate(`map.${key}`, fallback),
    update: (next) => props.context.updateSettings(next),
  })
);
</script>

<template>
  <ViewSettingsPanel :fields="panel.fields" :properties="panel.properties">
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
