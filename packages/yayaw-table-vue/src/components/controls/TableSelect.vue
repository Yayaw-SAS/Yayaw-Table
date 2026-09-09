<script setup lang="ts" generic="T extends string | number">
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
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { useId, useTemplateRef } from "vue";
import { useOverlayTheme } from "../../composables/use-overlay-theme";

const props = defineProps<{
  label: string;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}>();
const model = defineModel<T>({ required: true });
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const id = useId();
// Reka reserves an empty string for its placeholder; encode option values losslessly.
const optionKey = (value: T): string => JSON.stringify(value);
const select = (value: unknown): void => {
  const option = props.options.find((item) => optionKey(item.value) === value);
  if (option) {
    model.value = option.value;
  }
};
</script>

<template>
  <div ref="anchor" class="yayaw-control-field">
    <label :for="id">{{ label }}</label>
    <SelectRoot
      :model-value="optionKey(model)"
      :disabled="disabled"
      @update:model-value="select"
      @update:open="updateOpen"
    >
      <SelectTrigger
        :id="id"
        :aria-label="label"
        class="yayaw-select-trigger"
        data-slot="select-trigger"
      >
        <SelectValue :placeholder="label" />
        <SelectIcon as-child>
          <ChevronDown :size="16" aria-hidden="true" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="yayaw-column-menu yayaw-select-content"
          :style="overlayStyle"
          position="popper"
          :side-offset="4"
          :collision-padding="8"
          :aria-label="label"
          data-slot="select-content"
        >
          <SelectScrollUpButton class="yayaw-select-scroll">
            <ChevronUp :size="16" aria-hidden="true" />
          </SelectScrollUpButton>
          <SelectViewport class="yayaw-select-viewport">
            <SelectItem
              v-for="option in options"
              :key="optionKey(option.value)"
              :value="optionKey(option.value)"
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
