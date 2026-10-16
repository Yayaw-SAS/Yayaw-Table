<script setup lang="ts">
import type { TableDisplayMode } from "../../types";
import { displayModeIcons } from "./display-mode-icons";

/** The view's layout as Notion offers it: one tile per display mode, icon over name, the current one marked. */
defineProps<{ label: string; modes: { value: TableDisplayMode; label: string }[]; disabled?: boolean }>();
const model = defineModel<TableDisplayMode>({ required: true });
</script>

<template>
  <fieldset class="yayaw-layout-picker" :disabled="disabled">
    <legend>{{ label }}</legend>
    <button v-for="mode in modes" :key="mode.value" type="button" class="yayaw-layout-tile" :data-layout="mode.value"
      :aria-pressed="model === mode.value" @click="model = mode.value">
      <component :is="displayModeIcons[mode.value]" :size="20" aria-hidden="true" />
      <span>{{ mode.label }}</span>
    </button>
  </fieldset>
</template>
