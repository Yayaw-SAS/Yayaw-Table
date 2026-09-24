<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical } from "lucide-vue-next";
import { computed, nextTick, ref, useId } from "vue";
import {
  type ChartViewSettings,
  chartSettingFields,
  chartStageList,
} from "../chart-model";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";

const props = defineProps<{ context: DisplayModeSettingsContext }>();
const id = useId();
const view = computed(() => props.context.settings as ChartViewSettings);
const input = computed(() => ({
  columns: props.context.columns,
  defaults: props.context.defaults as ChartViewSettings,
  view: view.value,
  locale: props.context.locale,
  translate: (key: string, fallback: string) =>
    props.context.translate(`chart.${key}`, fallback),
  update: (next: Record<string, unknown>) => props.context.updateSettings(next),
}));
const fields = computed(() => chartSettingFields(input.value));
/** A funnel's stages: drag one, or use its arrows, to change the order. */
const stages = computed(() => chartStageList(input.value));

const root = ref<HTMLElement>();
const dragged = ref<number>();
const target = ref<number>();
const endDrag = (): void => {
  dragged.value = undefined;
  target.value = undefined;
};
const onDragStart = (event: DragEvent, index: number, label: string): void => {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", label);
  }
  dragged.value = index;
};
const onDragOver = (event: DragEvent, index: number): void => {
  if (dragged.value === undefined) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  target.value = index;
};
const onDrop = (event: DragEvent, index: number): void => {
  event.preventDefault();
  if (dragged.value !== undefined && dragged.value !== index) {
    stages.value?.move(dragged.value, index);
  }
  endDrag();
};
// The moved stage keeps the focus, on the arrow that can still move it.
const moveByKeyboard = async (from: number, to: number, value: string): Promise<void> => {
  stages.value?.move(from, to);
  await nextTick();
  const buttons = [
    ...(root.value?.querySelectorAll<HTMLButtonElement>(
      `[data-stage-move="${CSS.escape(value)}"]`
    ) ?? []),
  ];
  const preferred = to < from ? buttons.at(0) : buttons.at(1);
  (preferred?.disabled ? buttons.find((button) => !button.disabled) : preferred)?.focus();
};
</script>

<template>
  <ViewSettingsPanel :fields="fields">
    <div v-if="stages" ref="root" class="yayaw-chart-stages" data-chart-stages>
      <p :id="`${id}-stages`" class="yayaw-chart-stages-label">{{ stages.label }}</p>
      <ol :aria-labelledby="`${id}-stages`" class="yayaw-chart-stages-list">
        <li
          v-for="(stage, index) in stages.stages"
          :key="stage.value"
          class="yayaw-chart-stage"
          :data-stage="stage.value"
          :data-drop-target="target === index && dragged !== index ? 'true' : undefined"
          :data-dragging="dragged === index ? 'true' : undefined"
          draggable="true"
          @dragstart="onDragStart($event, index, stage.label)"
          @dragover="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="endDrag"
        >
          <GripVertical :size="16" aria-hidden="true" class="yayaw-chart-stage-grip" />
          <span class="yayaw-chart-stage-name">{{ stage.label }}</span>
          <button
            type="button"
            class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-chart-stage-move"
            :aria-label="stage.moveUpLabel"
            :data-stage-move="stage.value"
            :disabled="index === 0"
            @click="moveByKeyboard(index, index - 1, stage.value)"
          >
            <ArrowUp :size="14" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-chart-stage-move"
            :aria-label="stage.moveDownLabel"
            :data-stage-move="stage.value"
            :disabled="index === stages.stages.length - 1"
            @click="moveByKeyboard(index, index + 1, stage.value)"
          >
            <ArrowDown :size="14" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <p class="yayaw-chart-stages-hint">{{ stages.hint }}</p>
      <button
        v-if="stages.customized"
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-chart-stages-reset"
        @click="stages.reset()"
      >
        {{ stages.resetLabel }}
      </button>
    </div>
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
