<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "../../context";
import { availableDisplayModes } from "../../view-menu";
import type { TableDisplayMode } from "../../types";
import { displayModeIcons } from "./display-mode-icons";

/** Above this many modes the segments keep their icon only; the name stays in a tooltip. */
const LABELLED_SEGMENTS = 4;

/**
 * The view's display modes as a segmented control beside the filters: one
 * click changes the mode, without opening the view settings. Hidden when the
 * table offers a single mode or `table.displayModeSwitch` is false.
 */
const context = useTableContext();
const modes = computed<TableDisplayMode[]>(() =>
  availableDisplayModes(context.config.table.displayModes, {
    columns: context.config.columns.definitions,
    planning: Boolean(context.planning),
    renderers: Object.keys(context.displayModeRenderers ?? {}),
  })
);
const translate = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);
const labelled = computed(() => modes.value.length <= LABELLED_SEGMENTS);
const label = (mode: TableDisplayMode): string =>
  translate(`display.${mode}`, mode);
</script>

<template>
  <fieldset v-if="modes.length > 1 && context.config.table.displayModeSwitch !== false" class="yayaw-mode-switch" data-display-mode-switch="">
    <legend>{{ translate('displayMode', 'Display mode') }}</legend>
    <button v-for="mode in modes" :key="mode" type="button" class="yayaw-mode-segment" :data-layout="mode"
      :data-icon-only="labelled ? undefined : ''" :aria-pressed="context.state.displayMode.value === mode"
      :aria-label="labelled ? undefined : label(mode)" :title="labelled ? undefined : label(mode)"
      @click="context.state.displayMode.value = mode">
      <component :is="displayModeIcons[mode]" :size="16" aria-hidden="true" />
      <span v-if="labelled">{{ label(mode) }}</span>
    </button>
  </fieldset>
</template>
