<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { onMounted, ref, type CSSProperties, useId } from "vue";

defineProps<{
  open: boolean;
  title: string;
  description?: string;
  presentation?: "drawer" | "modal";
  width?: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const descriptionId = useId();
const anchor = ref<HTMLElement>();
const theme = ref<CSSProperties>({});
let opener: HTMLElement | undefined;
onMounted(() => {
  opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  if (!anchor.value) return;
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
  if (opener?.isConnected) {
    event.preventDefault();
    opener.focus();
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
          :data-presentation="presentation ?? 'drawer'"
          :style="{ width }"
          :aria-describedby="description ? descriptionId : undefined"
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
        >
          <header class="yayaw-form-header">
            <div>
              <DialogTitle as="h3">{{ title }}</DialogTitle
              ><DialogDescription v-if="description" :id="descriptionId">{{
                description
              }}</DialogDescription>
            </div>
            <button
              type="button"
              class="yayaw-icon-button"
              aria-label="Close"
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
