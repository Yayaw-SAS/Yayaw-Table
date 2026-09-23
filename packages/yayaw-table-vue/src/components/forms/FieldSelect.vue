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
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import { optionControlKey, optionControlValue } from "../../table-contracts";
import type { SelectOption } from "../../types";

/**
 * A record form select: the table's dropdown (as in the Form view and the
 * React edition), with a "Choose…" placeholder and typed option values.
 */
const props = defineProps<{
  id: string;
  modelValue: unknown;
  options: readonly SelectOption[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  labelledBy?: string;
  describedBy?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const empty = (value: unknown) => value === undefined || value === null || value === "";
/** Existing values missing from the options still show, as in React. */
const items = computed(() =>
  empty(props.modelValue) ||
  props.options.some((option) => Object.is(option.value, props.modelValue))
    ? props.options
    : [...props.options, { label: String(props.modelValue), value: props.modelValue as string }]
);
const selected = computed(() =>
  empty(props.modelValue)
    ? undefined
    : items.value.find((option) => Object.is(option.value, props.modelValue))
);
</script>

<template>
  <div ref="anchor" class="yayaw-field-select">
    <SelectRoot
      :model-value="selected ? optionControlKey(selected.value) : undefined"
      :disabled="disabled"
      :required="required"
      @update:model-value="emit('update:modelValue', typeof $event === 'string' ? optionControlValue($event) : null)"
      @update:open="updateOpen"
    >
      <SelectTrigger
        :id="id"
        class="yayaw-select-trigger yayaw-form-select"
        data-slot="select-trigger"
        :aria-labelledby="labelledBy"
        :aria-describedby="describedBy"
        :aria-invalid="invalid || undefined"
        :aria-required="required || undefined"
      >
        <span class="yayaw-form-select-value" :data-placeholder="selected ? undefined : ''">
          {{ selected?.label ?? placeholder }}
        </span>
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
          data-slot="select-content"
        >
          <SelectScrollUpButton class="yayaw-select-scroll">
            <ChevronUp :size="16" aria-hidden="true" />
          </SelectScrollUpButton>
          <SelectViewport class="yayaw-select-viewport">
            <SelectItem
              v-for="option in items"
              :key="optionControlKey(option.value)"
              :value="optionControlKey(option.value)"
              :disabled="option.disabled"
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
