<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { nextTick, onMounted, ref, type CSSProperties } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  presentation?: "drawer" | "modal";
  width?: string;
  busy?: boolean;
  returnFocus?: HTMLElement;
  closeLabel?: string;
  role?: "alertdialog" | "dialog";
}>();
const emit = defineEmits<{ close: []; openAutoFocus: [event: Event] }>();
const anchor = ref<HTMLElement>();
const theme = ref<CSSProperties>({});
let opener: HTMLElement | undefined;
let fallback: HTMLElement | null = null;
onMounted(() => {
  opener =
    props.returnFocus ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined);
  if (!anchor.value) return;
  fallback = anchor.value.closest<HTMLElement>(".yayaw-table");
  const style = getComputedStyle(anchor.value);
  const tokens = [
    "background",
    "foreground",
    "muted",
    "muted-foreground",
    "border",
    "primary",
    "primary-foreground",
    "danger",
    "radius",
    "shadow",
  ];
  const values: Record<string, string> = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
  };
  for (const token of tokens) {
    for (const name of [`--yayaw-${token}`, `--${token}`]) {
      const value = style.getPropertyValue(name).trim();
      if (value) values[name] = value;
    }
  }
  theme.value = values;
});
const restoreFocus = (event: Event): void => {
  const target =
    opener?.isConnected && opener !== document.body ? opener : fallback;
  if (target?.isConnected) {
    event.preventDefault();
    // The bulk trigger is re-enabled by the same update that closes the form.
    void nextTick(() => target.focus());
  }
};
</script>

<template>
  <span ref="anchor" hidden />
  <DialogRoot
    :open="open"
    @update:open="
      (value) => {
        if (!value && !busy) emit('close');
      }
    "
  >
    <DialogPortal>
      <DialogOverlay
        class="yayaw-dialog-backdrop yayaw-dialog-layer"
        :style="theme"
      >
        <DialogContent
          class="yayaw-form-surface"
          :role="role ?? 'dialog'"
          :data-presentation="presentation ?? 'drawer'"
          :style="{ width }"
          v-bind="description ? {} : { 'aria-describedby': undefined }"
          @escape-key-down="
            (event) => {
              if (busy) event.preventDefault();
            }
          "
          @interact-outside="
            (event) => {
              if (busy) event.preventDefault();
            }
          "
          @close-auto-focus="restoreFocus"
          @open-auto-focus="emit('openAutoFocus', $event)"
        >
          <header class="yayaw-form-header">
            <div>
              <DialogTitle as="h3">{{ title }}</DialogTitle
              ><DialogDescription v-if="description">{{
                description
              }}</DialogDescription>
            </div>
            <button
              type="button"
              class="yayaw-icon-button"
              :aria-label="closeLabel ?? 'Close'"
              :disabled="busy"
              @click="emit('close')"
            >
              ×
            </button>
          </header>
          <slot />
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>
