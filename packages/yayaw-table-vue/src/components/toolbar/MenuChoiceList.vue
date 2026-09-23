<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { type Component, useId } from "vue";

/** One choice per row, for settings screens in touch drawers. */
defineProps<{
  label: string;
  modelValue: string;
  options: { value: string; label: string; icon?: Component }[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const name = useId();
</script>

<template>
  <fieldset class="yayaw-choice-list">
    <legend class="yayaw-sr-only">{{ label }}</legend>
    <label v-for="option in options" :key="option.value" class="yayaw-options-item">
      <input class="yayaw-sr-only" type="radio" :name="name" :value="option.value" :checked="option.value === modelValue"
        @change="emit('update:modelValue', option.value)" />
      <span v-if="option.icon" class="yayaw-options-item-icon"><component :is="option.icon" :size="16" aria-hidden="true" /></span>
      <span class="yayaw-options-item-copy"><span>{{ option.label }}</span></span>
      <Check v-if="option.value === modelValue" :size="16" aria-hidden="true" />
    </label>
  </fieldset>
</template>
