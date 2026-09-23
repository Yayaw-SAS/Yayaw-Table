<script setup lang="ts">
import { ref, watch } from "vue";

/** A value typed in a rule, saved when it loses focus or on Enter. */
const props = defineProps<{
  label: string;
  value: string;
  type: "number" | "text";
  /** Shown after the input, e.g. "days". */
  unit?: string;
  describedBy?: string;
  invalid?: boolean;
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
  <span v-if="unit" class="yayaw-rule-unit">
    <input
      v-model="draft"
      class="yayaw-input yayaw-rule-input"
      type="text"
      autocomplete="off"
      :aria-label="label"
      :aria-describedby="describedBy"
      :aria-invalid="invalid || undefined"
      :inputmode="type === 'number' ? 'decimal' : undefined"
      :data-number="type === 'number' || undefined"
      @blur="commit"
      @keydown.enter.prevent="commit"
    />
    <span aria-hidden="true">{{ unit }}</span>
  </span>
  <input
    v-else
    v-model="draft"
    class="yayaw-input yayaw-rule-input"
    type="text"
    autocomplete="off"
    :aria-label="label"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :inputmode="type === 'number' ? 'decimal' : undefined"
    :data-number="type === 'number' || undefined"
    @blur="commit"
    @keydown.enter.prevent="commit"
  />
</template>
