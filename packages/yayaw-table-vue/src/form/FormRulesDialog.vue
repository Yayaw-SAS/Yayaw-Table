<script setup lang="ts">
import { X } from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import {
  type CSSProperties,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

/**
 * "Edit conditions": the rules of one question at a comfortable width, a
 * centered dialog on larger screens and the table's bottom sheet on phones.
 * Changes are saved as they are made; "Done" closes.
 */
const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  doneLabel: string;
  closeLabel: string;
}>();
const emit = defineEmits<{ "update:open": [open: boolean] }>();

const COMPACT_QUERY = "(max-width: 767px)";
const media =
  typeof window === "undefined" ? undefined : window.matchMedia?.(COMPACT_QUERY);
const compact = ref(media?.matches ?? false);
const syncCompact = (): void => {
  compact.value = media?.matches ?? false;
};
onMounted(() => media?.addEventListener("change", syncCompact));
onBeforeUnmount(() => media?.removeEventListener("change", syncCompact));

// The dialog is portalled: it keeps the table's theme tokens and font.
const anchor = ref<HTMLElement>();
const theme = ref<CSSProperties>({});
watch(
  () => props.open,
  (open) => {
    if (!(open && anchor.value)) return;
    const style = getComputedStyle(anchor.value);
    const values: Record<string, string> = { fontFamily: style.fontFamily };
    for (const token of [
      "background",
      "foreground",
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
    ]) {
      for (const name of [`--yayaw-${token}`, `--${token}`]) {
        const value = style.getPropertyValue(name).trim();
        if (value) values[name] = value;
      }
    }
    theme.value = values;
  },
  { immediate: true }
);
</script>

<template>
  <span ref="anchor" class="yayaw-rules-dialog-anchor">
    <DialogRoot :open="open" @update:open="emit('update:open', $event)">
      <DialogPortal>
        <DialogOverlay class="yayaw-rules-dialog-backdrop" :style="theme" />
        <DialogContent
          class="yayaw-rules-dialog"
          :data-compact="compact || undefined"
          :style="theme"
          data-form-rules-dialog
        >
          <div v-if="compact" class="yayaw-toolbar-handle" />
          <header class="yayaw-rules-dialog-header">
            <DialogTitle as="h2" class="yayaw-rules-dialog-title">{{ title }}</DialogTitle>
            <DialogDescription class="yayaw-rules-dialog-description">{{ description }}</DialogDescription>
            <DialogClose
              v-if="!compact"
              class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-rules-dialog-close"
              :aria-label="closeLabel"
            >
              <X :size="16" aria-hidden="true" />
            </DialogClose>
          </header>
          <div class="yayaw-rules-dialog-body" data-form-rules-body>
            <slot />
          </div>
          <footer class="yayaw-rules-dialog-footer">
            <button type="button" class="yayaw-button" @click="emit('update:open', false)">{{ doneLabel }}</button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </span>
</template>
