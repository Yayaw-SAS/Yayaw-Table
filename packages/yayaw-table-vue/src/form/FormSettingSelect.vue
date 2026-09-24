<script setup lang="ts">
/** A labelled settings select (the rule editor's compact select). */
import FormRuleSelect, { type RuleOption } from "./FormRuleSelect.vue";

defineProps<{
  label: string;
  value: string;
  options: readonly RuleOption[];
  placeholder?: string;
}>();
const emit = defineEmits<{ change: [value: string] }>();
</script>

<template>
  <div class="yayaw-form-setting">
    <span class="yayaw-form-setting-label" aria-hidden="true">{{ label }}</span>
    <FormRuleSelect
      :label="label"
      :value="value"
      :options="options"
      :placeholder="placeholder"
      @change="emit('change', $event)"
    />
  </div>
</template>
