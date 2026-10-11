<script setup lang="ts">
import { computed, ref, useId } from "vue";
import {
  deleteConfirmationMatches,
  deleteConfirmationPrompt,
  type DeleteConfirmationConfig,
  type DetailLabels,
} from "../../record-details";
import "../../record-details.css";

const props = defineProps<{
  expected: string;
  modelValue: string;
  labels: Pick<DetailLabels, "typeToConfirm" | "confirmationMismatch">;
  confirmation?: DeleteConfirmationConfig;
  disabled?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; submit: [] }>();
const id = useId();
const input = ref<HTMLInputElement>();
const mismatch = computed(
  () =>
    props.modelValue.trim() !== "" &&
    !deleteConfirmationMatches(props.expected, props.modelValue, props.confirmation)
);
const submit = (event: KeyboardEvent): void => {
  if (!deleteConfirmationMatches(props.expected, props.modelValue, props.confirmation)) return;
  event.preventDefault();
  emit("submit");
};
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="yayaw-typed-confirm">
    <label :for="`${id}-input`">{{ deleteConfirmationPrompt(expected, labels) }}</label>
    <input :id="`${id}-input`" ref="input" type="text" data-typed-confirmation="" autocomplete="off" autocapitalize="off" spellcheck="false"
      :value="modelValue" :disabled="disabled" :aria-invalid="mismatch" :aria-describedby="mismatch ? `${id}-error` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @keydown.enter="submit" />
    <p v-if="mismatch" :id="`${id}-error`" class="yayaw-typed-confirm-error">{{ labels.confirmationMismatch }}</p>
  </div>
</template>
