<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { Check, X } from "lucide-vue-next";
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot,
} from "reka-ui";
import { useTableTranslation } from "../../context";
import type { SelectOption } from "../../types";

const props = defineProps<{
  modelValue: unknown;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: unknown[]];
  commit: [];
  cancel: [];
}>();
const translate = useTableTranslation();
const query = ref("");
const anchor = ref<HTMLElement>();
const selected = computed<unknown[]>(() => Array.isArray(props.modelValue) ? props.modelValue : []);
// Typed keys keep numeric, boolean and string catalogue IDs distinct.
const keyFor = (value: unknown): string => `${typeof value}:${String(value)}`;
const choices = computed(() => {
  const result = new Map(props.options.map(option => [keyFor(option.value), { ...option, key: keyFor(option.value) }]));
  for (const value of selected.value) {
    const key = keyFor(value);
    if (!result.has(key)) result.set(key, { label: String(value), value: value as SelectOption["value"], key });
  }
  return [...result.values()];
});
const selectedKeys = computed(() => selected.value.map(keyFor));
const selectedOptions = computed(() => selectedKeys.value.map(key => choices.value.find(option => option.key === key)!));
const update = (value: string | string[]): void => {
  const keys = Array.isArray(value) ? value : [value];
  emit("update:modelValue", keys.map(key => choices.value.find(option => option.key === key)!.value));
};
const remove = (key: string): void => {
  if (props.disabled || choices.value.find(option => option.key === key)?.disabled) return;
  update(selectedKeys.value.filter(value => value !== key));
  void nextTick(() => anchor.value?.querySelector("input")?.focus());
};
const onKeydown = (event: KeyboardEvent): void => {
  if (event.isComposing) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("cancel");
  } else if (event.key === "Enter") {
    // Reka handles Enter on the highlighted option; it must not bubble to the cell.
    event.stopPropagation();
    if (!(event.target as HTMLElement).getAttribute("aria-activedescendant")) {
      event.preventDefault();
      emit("commit");
    }
  } else if (event.key === "Backspace" && !query.value && selectedOptions.value.length) {
    event.preventDefault();
    const last = selectedOptions.value.at(-1)!;
    remove(last.key);
  }
};
// Keep the editor open until the parent acknowledges dismissal and saves its draft.
const dismiss = (open: boolean): void => { if (!open) emit("commit"); };
onMounted(async () => { await nextTick(); anchor.value?.querySelector("input")?.focus(); });
</script>

<template>
  <ComboboxRoot multiple :open="true" :model-value="selectedKeys" :disabled="disabled" @update:model-value="update" @update:open="dismiss">
    <ComboboxAnchor as-child>
      <div ref="anchor" class="yayaw-inline-editor yayaw-inline-selection">
        <div class="yayaw-inline-chips">
        <span v-for="option in selectedOptions" :key="option.key" class="yayaw-inline-chip">
          {{ option.label }}
          <button v-if="!option.disabled" type="button" :aria-label="`${translate('remove', 'Remove')} ${option.label}`" :disabled="disabled || option.disabled" @click.stop="remove(option.key)"><X :size="12" aria-hidden="true" /></button>
        </span>
        </div>
        <ComboboxInput v-model="query" class="yayaw-inline-search" :aria-label="label" :placeholder="selected.length ? undefined : translate('inline.select_no_options', 'Select an option')" autocomplete="off" @keydown="onKeydown" />
      </div>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent class="yayaw-inline-options" position="popper" align="start" :side-offset="6" :collision-padding="8" :aria-label="label" :aria-busy="disabled" @escape-key-down.prevent="emit('cancel')">
        <ComboboxEmpty class="yayaw-inline-empty">{{ translate('filters.noResults', 'No results') }}</ComboboxEmpty>
        <ComboboxItem v-for="option in choices" :key="option.key" :value="option.key" :text-value="option.label" :disabled="option.disabled" class="yayaw-inline-option">
          {{ option.label }}
          <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
