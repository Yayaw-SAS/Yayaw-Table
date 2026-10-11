<script setup lang="ts">
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import { useId } from "vue";
import {
  type KanbanLaneSettings,
  moveKanbanLane,
  setKanbanLaneHidden,
} from "../../kanban-lanes";
import TableCheckbox from "../controls/TableCheckbox.vue";

/**
 * Lane order and visibility of the grouping column: a checkbox shows or
 * hides each lane, and move buttons reorder them. At an end, a move stays
 * focusable but inactive, as the view order's moves do.
 */
const props = defineProps<{
  /** Every lane, in the current order, hidden ones included. */
  lanes: { value: string; label: string }[];
  settings: KanbanLaneSettings;
  /** The view changes the lanes: Reset lanes restores the default ones. */
  resettable: boolean;
  translate: (key: string, fallback: string) => string;
}>();
const emit = defineEmits<{
  change: [settings: KanbanLaneSettings | undefined];
}>();
const id = useId();
const text = (key: string, fallback: string, lane: string): string =>
  props.translate(key, fallback).replaceAll("{lane}", lane);
const hidden = (value: string): boolean =>
  (props.settings.hidden ?? []).includes(value);
const move = (value: string, offset: number): void => {
  emit(
    "change",
    moveKanbanLane(
      props.settings,
      props.lanes.map((lane) => lane.value),
      value,
      offset
    )
  );
};
const show = (value: string, checked: boolean): void => {
  emit("change", setKanbanLaneHidden(props.settings, value, !checked));
};
</script>

<template>
  <fieldset v-if="lanes.length" class="yayaw-kanban-lane-settings" data-kanban-lane-settings="">
    <legend>{{ translate("kanbanLanes", "Lanes") }}</legend>
    <ul>
      <li
        v-for="(lane, index) in lanes"
        :key="lane.value"
        class="yayaw-settings-choice"
        :data-kanban-lane-setting="lane.value"
      >
        <TableCheckbox
          :id="`${id}-lane-${index}`"
          :label="text('kanbanShowLane', 'Show {lane}', lane.label)"
          :model-value="!hidden(lane.value)"
          @update:model-value="show(lane.value, $event)"
        />
        <label :for="`${id}-lane-${index}`">{{ lane.label }}</label>
        <button
          type="button"
          class="yayaw-icon-button"
          :aria-label="text('kanbanMoveLaneUp', 'Move {lane} up', lane.label)"
          :aria-disabled="index === 0 || undefined"
          @click="index > 0 && move(lane.value, -1)"
        >
          <ArrowUp :size="14" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="yayaw-icon-button"
          :aria-label="text('kanbanMoveLaneDown', 'Move {lane} down', lane.label)"
          :aria-disabled="index === lanes.length - 1 || undefined"
          @click="index < lanes.length - 1 && move(lane.value, 1)"
        >
          <ArrowDown :size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="yayaw-button yayaw-button-ghost"
      :disabled="!resettable"
      @click="emit('change', undefined)"
    >
      {{ translate("kanbanResetLanes", "Reset lanes") }}
    </button>
  </fieldset>
</template>
