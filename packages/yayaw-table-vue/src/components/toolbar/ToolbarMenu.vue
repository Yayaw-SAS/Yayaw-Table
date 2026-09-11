<script setup lang="ts">
import { ArrowLeft, X } from "lucide-vue-next";
import {
  DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger,
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { ref, watch, type CSSProperties } from "vue";

const props = defineProps<{ open: boolean; compact?: boolean; title: string; back?: boolean; backLabel?: string; closeLabel?: string }>();
const emit = defineEmits<{ "update:open": [open: boolean]; back: [] }>();
const anchor = ref<HTMLElement>();
const theme = ref<CSSProperties>({});
watch(() => props.open, (open) => {
  if (!open || !anchor.value) return;
  const style = getComputedStyle(anchor.value);
  const values: Record<string, string> = { fontFamily: style.fontFamily };
  for (const token of ["background", "foreground", "muted", "muted-foreground", "border", "primary", "primary-foreground", "danger", "radius", "shadow"]) {
    for (const name of [`--yayaw-${token}`, `--${token}`]) {
      const value = style.getPropertyValue(name).trim();
      if (value) values[name] = value;
    }
  }
  theme.value = values;
});
</script>

<template>
  <span ref="anchor" class="yayaw-menu-anchor">
    <component :is="compact ? DialogRoot : PopoverRoot" :open="open" :modal="Boolean(compact)" @update:open="emit('update:open', $event)">
      <component :is="compact ? DialogTrigger : PopoverTrigger" as-child><slot name="trigger" /></component>
      <component :is="compact ? DialogPortal : PopoverPortal">
        <DialogOverlay v-if="compact" class="yayaw-toolbar-backdrop" :style="theme" />
        <component :is="compact ? DialogContent : PopoverContent" class="yayaw-toolbar-menu" :data-compact="Boolean(compact)" :style="theme"
          :aria-label="title" :aria-describedby="undefined" :align="compact ? undefined : 'start'" :side-offset="compact ? undefined : 5" :collision-padding="8">
          <div v-if="compact" class="yayaw-toolbar-handle" />
          <header class="yayaw-toolbar-menu-header">
            <button v-if="back" class="yayaw-icon-button" type="button" :aria-label="backLabel ?? 'Back'" @click="emit('back')"><ArrowLeft :size="16" /></button>
            <DialogTitle v-if="compact" as="strong">{{ title }}</DialogTitle><strong v-else>{{ title }}</strong>
            <button class="yayaw-icon-button" type="button" :aria-label="closeLabel ?? 'Close'" @click="emit('update:open', false)"><X :size="16" /></button>
          </header>
          <div class="yayaw-toolbar-menu-body"><slot /></div>
        </component>
      </component>
    </component>
  </span>
</template>
