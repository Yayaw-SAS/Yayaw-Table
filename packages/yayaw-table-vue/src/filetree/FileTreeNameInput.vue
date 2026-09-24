<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

/** Inline text field for renaming and for a new folder's name. */
const props = defineProps<{ initial: string; label: string; error?: string }>();
const emit = defineEmits<{ commit: [value: string]; cancel: [] }>();
const input = ref<HTMLInputElement>();
let done = false;
onMounted(() => {
  input.value?.focus();
  input.value?.select();
});
const commit = (value: string): void => {
  if (!done) {
    done = true;
    emit("commit", value);
  }
};
const onKeydown = (event: KeyboardEvent): void => {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.preventDefault();
    commit((event.currentTarget as HTMLInputElement).value);
  } else if (event.key === "Escape") {
    event.preventDefault();
    done = true;
    emit("cancel");
  }
};
// A server error keeps the field open for another try.
watch(
  () => props.error,
  (error) => {
    if (error) {
      done = false;
      input.value?.focus();
    }
  }
);
</script>

<template>
  <input
    ref="input"
    class="yayaw-ft-rename"
    :aria-label="props.label"
    :aria-invalid="props.error ? true : undefined"
    :value="props.initial"
    @blur="commit(($event.currentTarget as HTMLInputElement).value)"
    @click.stop
    @keydown="onKeydown"
  />
  <span v-if="props.error" class="yayaw-ft-error" role="alert">{{ props.error }}</span>
</template>
