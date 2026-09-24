<script setup lang="ts">
import { useId } from "vue";
import type { FileTreeController } from "../filetree-controller";
import type { FileTreeLabelKey } from "../filetree-model";
import FileTreeDialog from "./FileTreeDialog.vue";

/** Confirmation before deleting; the host's delete action decides what happens to a folder's content. */
const props = defineProps<{
  controller: FileTreeController;
  ids: string[];
  label: (key: FileTreeLabelKey, params?: Record<string, string | number>) => string;
}>();
const emit = defineEmits<{ close: [] }>();
const titleId = `yayaw-ft-delete-${useId()}`;
const descriptionId = `${titleId}-description`;
const title =
  props.ids.length === 1
    ? props.label("deleteOneTitle", { name: props.controller.name(props.ids[0] ?? "") })
    : props.label("deleteTitle", { count: props.ids.length });
const confirm = (): void => {
  emit("close");
  props.controller.remove(props.ids).catch(() => undefined);
};
</script>

<template>
  <FileTreeDialog :labelled-by="titleId" :described-by="descriptionId" role="alertdialog" @close="emit('close')">
    <h2 :id="titleId">{{ title }}</h2>
    <p :id="descriptionId">{{ props.label("deleteDescription") }}</p>
    <span />
    <footer>
      <button type="button" class="yayaw-ft-button" @click="emit('close')">{{ props.label("cancel") }}</button>
      <button type="button" class="yayaw-ft-button" data-variant="danger" @click="confirm">{{ props.label("delete") }}</button>
    </footer>
  </FileTreeDialog>
</template>
