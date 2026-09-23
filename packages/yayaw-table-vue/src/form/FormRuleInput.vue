<script setup lang="ts">
import { ref, watch } from "vue";

/** A value typed in a rule, saved when it loses focus or on Enter. */
const props = defineProps<{
  label: string;
  value: string;
  type: "date" | "number" | "text";
}>();
const emit = defineEmits<{ commit: [value: string] }>();
const draft = ref(props.value);
watch(
  () => props.value,
  (value) => {
    draft.value = value;
  }
);
const commit = (): void => {
  if (draft.value !== props.value) emit("commit", draft.value);
};
</script>

<template>
  <input
    v-model="draft"
    class="yayaw-input yayaw-rule-input"
    :aria-label="label"
    :type="type === 'date' ? 'date' : 'text'"
    :inputmode="type === 'number' ? 'decimal' : undefined"
    @blur="commit"
    @keydown.enter.prevent="commit"
  />
</template>
