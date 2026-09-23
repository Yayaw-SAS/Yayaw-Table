<script setup lang="ts">
import { ref, watch } from "vue";

/** A text setting saved when it loses focus or on Enter, not on every key. */
const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    value: string;
    multiline?: boolean;
    type?: string;
  }>(),
  { type: "text" }
);
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
  <div class="yayaw-form-setting">
    <label class="yayaw-form-setting-label" :for="id">{{ label }}</label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="draft"
      class="yayaw-textarea"
      rows="2"
      @blur="commit"
    />
    <input
      v-else
      :id="id"
      v-model="draft"
      class="yayaw-input"
      :type="type"
      @blur="commit"
      @keydown.enter.prevent="commit"
    />
  </div>
</template>
