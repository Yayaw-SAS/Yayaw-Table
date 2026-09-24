<script setup lang="ts">
import { computed } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import {
  type FileTreeColumn,
  type FileTreeViewSettings,
  fileTreeSettingFields,
} from "../filetree-model";

/** View → Card settings of the file tree: columns, details pane, order and first load. */
const props = defineProps<{ context: DisplayModeSettingsContext }>();
const view = computed(() => props.context.settings as FileTreeViewSettings);
const fields = computed(() =>
  fileTreeSettingFields({
    columns: props.context.columns as FileTreeColumn[],
    defaults: props.context.defaults as FileTreeViewSettings,
    view: view.value,
    locale: props.context.locale,
    translate: (key, fallback) =>
      props.context.translate(`filetree.${key}`, fallback),
    update: (next) =>
      props.context.updateSettings(next as Record<string, unknown> | undefined),
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
