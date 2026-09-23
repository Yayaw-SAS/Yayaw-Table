<script setup lang="ts">
import { useModeSettingsContext } from "../../composables/use-mode-settings-context";
import type { DisplayModeRenderer } from "../../display-mode-renderer";

const props = defineProps<{ renderer: DisplayModeRenderer }>();
const settingsContext = useModeSettingsContext();
</script>

<template>
  <component :is="props.renderer.settings" v-if="props.renderer.settings" :context="settingsContext" />
</template>
