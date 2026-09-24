<script setup lang="ts">
import { computed } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import {
  type FeedColumn,
  type FeedViewSettings,
  feedSettingFields,
} from "../feed-view";

const props = defineProps<{ context: DisplayModeSettingsContext }>();
const view = computed(() => props.context.settings as FeedViewSettings);
const panel = computed(() =>
  feedSettingFields({
    columns: props.context.columns as unknown as FeedColumn[],
    defaults: props.context.defaults as FeedViewSettings,
    view: view.value,
    locale: props.context.locale,
    translate: (key, fallback) =>
      props.context.translate(`feed.${key}`, fallback),
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
