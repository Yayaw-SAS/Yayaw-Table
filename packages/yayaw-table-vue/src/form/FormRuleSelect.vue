<script setup lang="ts">
import { Check, ChevronDown, ChevronUp } from "lucide-vue-next";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectViewport,
} from "reka-ui";
import { computed, useTemplateRef } from "vue";
import { useOverlayTheme } from "../composables/use-overlay-theme";

/** A compact settings select of the rule editor, labelled for assistive technologies. */
const props = defineProps<{
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}>();
const emit = defineEmits<{ change: [value: string] }>();
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const selected = computed(() =>
  props.options.find((option) => option.value === props.value)
);
</script>

<template>
  <div ref="anchor" class="yayaw-rule-select">
    <SelectRoot
      :model-value="value || undefined"
      @update:model-value="typeof $event === 'string' && emit('change', $event)"
      @update:open="updateOpen"
    >
      <SelectTrigger
        class="yayaw-select-trigger yayaw-rule-select-trigger"
        data-slot="select-trigger"
        :aria-label="label"
      >
        <span class="yayaw-form-select-value" :data-placeholder="selected ? undefined : ''">
          {{ selected?.label ?? placeholder ?? "" }}
        </span>
        <SelectIcon as-child>
          <ChevronDown :size="14" aria-hidden="true" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="yayaw-column-menu yayaw-select-content"
          :style="overlayStyle"
          position="popper"
          :side-offset="4"
          :collision-padding="8"
          data-slot="select-content"
        >
          <SelectScrollUpButton class="yayaw-select-scroll">
            <ChevronUp :size="16" aria-hidden="true" />
          </SelectScrollUpButton>
          <SelectViewport class="yayaw-select-viewport">
            <SelectItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              class="yayaw-column-menu-item yayaw-select-item"
              data-slot="select-item"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
              <SelectItemIndicator class="yayaw-control-indicator">
                <Check :size="16" aria-hidden="true" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
          <SelectScrollDownButton class="yayaw-select-scroll">
            <ChevronDown :size="16" aria-hidden="true" />
          </SelectScrollDownButton>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>
