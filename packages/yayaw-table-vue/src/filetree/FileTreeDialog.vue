<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

/** A native modal dialog, the same element in both editions. */
const props = defineProps<{
  labelledBy: string;
  describedBy?: string;
  role?: "alertdialog" | "dialog";
}>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
onMounted(() => {
  if (dialog.value && !dialog.value.open) {
    dialog.value.showModal();
  }
});
onBeforeUnmount(() => dialog.value?.close());
const cancel = (event: Event): void => {
  event.preventDefault();
  emit("close");
};
</script>

<template>
  <dialog
    ref="dialog"
    class="yayaw-ft-dialog"
    :role="props.role === 'alertdialog' ? 'alertdialog' : undefined"
    :aria-labelledby="props.labelledBy"
    :aria-describedby="props.describedBy"
    @cancel="cancel"
  >
    <slot />
  </dialog>
</template>
