<script setup lang="ts">
/**
 * The form builder: a near full-screen dialog (full screen on phones, with
 * Questions, Preview and Properties tabs) editing a view's form: its outline
 * on the left, a live preview in the middle and the selected item's
 * properties on the right. Changes are kept until "Save"; closing with unsaved
 * changes asks first.
 */
import { DialogRoot } from "reka-ui";
import { type CSSProperties, nextTick, ref, watch } from "vue";
import type { FormColumn, FormTranslate, FormViewSettings } from "../form-view";
import FormBuilderSession, { type FormBuilderShare } from "./FormBuilderSession.vue";

const props = defineProps<{
  open: boolean;
  columns: readonly FormColumn[];
  /** The table's form settings (`table.form`). */
  defaults: unknown;
  /** The view's own form settings; the builder edits a copy. */
  settings: unknown;
  /** The table's language. */
  locale: string;
  translate?: FormTranslate;
  share?: FormBuilderShare;
  /** Where the focus goes when the builder closes. */
  finalFocus?: HTMLElement | null;
}>();
const emit = defineEmits<{
  "update:open": [open: boolean];
  save: [settings: FormViewSettings | undefined];
}>();

// The dialog is portalled: it keeps the table's theme tokens and font.
const anchor = ref<HTMLElement>();
const theme = ref<CSSProperties>({});
const TOKENS = [
  "background",
  "foreground",
  "card",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "danger",
  "ring",
  "radius",
  "shadow",
  "shadow-xs",
];
watch(
  () => props.open,
  async (open, was) => {
    if (open && anchor.value) {
      const style = getComputedStyle(anchor.value);
      const values: Record<string, string> = { fontFamily: style.fontFamily };
      for (const token of TOKENS) {
        for (const name of [`--yayaw-${token}`, `--${token}`]) {
          const value = style.getPropertyValue(name).trim();
          if (value) values[name] = value;
        }
      }
      theme.value = values;
    }
    if (!open && was) {
      await nextTick();
      props.finalFocus?.focus();
    }
  },
  { immediate: true }
);
</script>

<template>
  <span ref="anchor" class="yayaw-form-builder-anchor">
    <DialogRoot :open="open">
      <FormBuilderSession
        v-if="open"
        :columns="columns"
        :defaults="defaults"
        :settings="settings"
        :locale="locale"
        :translate="translate"
        :share="share"
        :theme="theme"
        @save="emit('save', $event)"
        @close="emit('update:open', false)"
      />
    </DialogRoot>
  </span>
</template>
