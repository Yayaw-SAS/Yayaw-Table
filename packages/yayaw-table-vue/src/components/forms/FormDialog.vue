<script setup lang="ts">
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type CSSProperties } from "vue";
import { RECORD_MOBILE_QUERY, recordSurfaceWidth, resolveRecordPresentation, type RecordPresentationConfig } from "../../record-presentation";
import RecordSurfaceHeader from "./RecordSurfaceHeader.vue";
import "../../record-surface.css";

const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  presentation?: RecordPresentationConfig;
  embedded?: boolean;
  headerless?: boolean;
  width?: string;
  busy?: boolean;
  bulk?: boolean;
  returnFocus?: HTMLElement;
  closeLabel?: string;
  role?: "alertdialog" | "dialog";
}>();
const emit = defineEmits<{ close: []; openAutoFocus: [event: Event] }>();
// A stable teleport target preserves field state when moving between inline and overlay hosts.
const contentContainer = typeof document === "undefined" ? undefined : document.createElement("div");
if (contentContainer) contentContainer.className = "yayaw-record-content";
const mountContent = (element: unknown) => {
  if (element instanceof HTMLElement && contentContainer) element.append(contentContainer);
};
const media = typeof window === "undefined" ? undefined : window.matchMedia?.(RECORD_MOBILE_QUERY);
const mobile = ref(media?.matches ?? false);
const syncMobile = () => { mobile.value = media?.matches ?? false; };
onMounted(() => media?.addEventListener("change", syncMobile));
onBeforeUnmount(() => media?.removeEventListener("change", syncMobile));
const presentation = computed(() => resolveRecordPresentation(props.presentation, mobile.value));
/** Pickers portal their popups (calendar, dropdowns): using them keeps the form open. */
const insideOverlay = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest("[data-reka-popper-content-wrapper], .yayaw-form-popover"));
const surfaceStyle = computed(() => ({ ...theme.value, "--record-width": recordSurfaceWidth(presentation.value, props.width) }));
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
  <template v-if="embedded && open">
    <RecordSurfaceHeader v-if="!headerless" :title="title" :description="description" :busy="busy" :close-label="closeLabel ?? 'Close'" @close="emit('close')" />
    <slot />
  </template>
  <DialogRoot v-else :open="open && presentation !== 'inline'" @update:open="value => { if (!value && !busy && presentation !== 'inline') emit('close'); }">
    <Teleport v-if="open && contentContainer" :to="contentContainer">
      <RecordSurfaceHeader v-if="!headerless" :title="title" :description="description" :busy="busy" :close-label="closeLabel ?? 'Close'" @close="emit('close')" />
      <slot />
    </Teleport>
    <section v-if="presentation === 'inline' && open" class="yayaw-record-surface" data-presentation="inline" :data-bulk-editor="bulk || undefined" :aria-label="title" :style="theme"><div :ref="mountContent" class="yayaw-record-content" /></section>
    <DialogPortal v-else>
      <DialogOverlay class="yayaw-dialog-backdrop yayaw-dialog-layer" :style="theme">
        <DialogContent
          class="yayaw-record-surface"
          :data-bulk-editor="bulk || undefined"
          :role="role ?? 'dialog'"
          :data-presentation="presentation"
          :style="surfaceStyle"
          :aria-describedby="undefined"
          @escape-key-down="event => { if (busy) event.preventDefault(); }"
          @interact-outside="event => { if (busy || insideOverlay(event.target)) event.preventDefault(); }"
          @close-auto-focus="restoreFocus"
          @open-auto-focus="emit('openAutoFocus', $event)"
        >
          <DialogTitle class="yayaw-sr-only">{{ title }}</DialogTitle>
          <div :ref="mountContent" class="yayaw-record-content" />
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>
