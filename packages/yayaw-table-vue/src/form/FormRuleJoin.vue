<script setup lang="ts">
import { computed, useId } from "vue";
import type { FormLabelKey } from "../form-view";

/** All/Any as a segmented control: two radios, arrow keys switch. */
const props = defineProps<{
  join: "and" | "or";
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
  /** The group already names itself; its "Match" legend is for screen readers. */
  quietLegend?: boolean;
}>();
const emit = defineEmits<{ change: [join: "and" | "or"] }>();
const name = useId();
const choices = computed(() => [
  { value: "and" as const, text: props.label("joinAll"), title: props.label("joinAnd") },
  { value: "or" as const, text: props.label("joinAny"), title: props.label("joinOr") },
]);
</script>

<template>
  <fieldset class="yayaw-rule-join" data-rule-join>
    <legend :class="quietLegend ? 'yayaw-sr-only' : 'yayaw-rule-join-legend'">{{ label("ruleJoin") }}</legend>
    <span class="yayaw-rule-join-options">
      <label v-for="choice in choices" :key="choice.value" class="yayaw-rule-join-option" :title="choice.title">
        <input
          class="yayaw-sr-only"
          type="radio"
          :name="name"
          :value="choice.value"
          :checked="join === choice.value"
          @change="emit('change', choice.value)"
        />{{ choice.text }}
      </label>
    </span>
  </fieldset>
</template>
