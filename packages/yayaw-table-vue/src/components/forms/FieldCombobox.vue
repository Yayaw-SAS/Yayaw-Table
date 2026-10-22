<script setup lang="ts">
import { Check, ChevronDown, X } from "lucide-vue-next";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from "reka-ui";
import { computed, ref, useTemplateRef } from "vue";
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import { formLabel } from "../../form-view";
import { optionControlKey, optionControlValue } from "../../table-contracts";
import type { SelectOption } from "../../types";

/**
 * A `searchable` select or multiSelect field: a button opening a list that
 * filters as you type. Several picks show as removable chips under it.
 */
const props = defineProps<{
  id: string;
  modelValue: unknown;
  options: readonly SelectOption[];
  multiple: boolean;
  label: string;
  placeholder: string;
  locale: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  labelledBy?: string;
  describedBy?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const query = ref("");
const empty = (value: unknown) => value === undefined || value === null || value === "";
const selected = computed<unknown[]>(() =>
  (props.multiple && Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]).filter(
    (value) => !empty(value)
  )
);
/** Existing values missing from the options still show, as in the plain select. */
const items = computed<SelectOption[]>(() => [
  ...props.options,
  ...selected.value
    .filter((value) => !props.options.some((option) => Object.is(option.value, value)))
    .map((value) => ({ label: String(value), value: value as SelectOption["value"] })),
]);
const labelOf = (value: unknown) =>
  items.value.find((option) => Object.is(option.value, value))?.label ?? String(value);
const keys = computed(() => selected.value.map(optionControlKey));
const text = (key: "noMatchingOption" | "searchOptions") => formLabel(key, props.locale);
const removeLabel = (value: unknown) =>
  formLabel("removeOption", props.locale, undefined, { label: labelOf(value) });
const update = (value: unknown): void => {
  if (props.multiple) {
    emit("update:modelValue", (Array.isArray(value) ? value : []).map((key) => optionControlValue(String(key))));
  } else {
    emit("update:modelValue", typeof value === "string" ? optionControlValue(value) : null);
  }
  // The next search starts empty, so several picks can be typed in a row.
  query.value = "";
};
const remove = (value: unknown): void => {
  emit(
    "update:modelValue",
    props.multiple ? selected.value.filter((item) => !Object.is(item, value)) : null
  );
};
const onOpen = (open: boolean): void => {
  updateOpen(open);
  if (!open) query.value = "";
};
</script>

<template>
  <div ref="anchor" class="yayaw-field-select yayaw-field-combobox">
    <div class="yayaw-field-combobox-row">
      <ComboboxRoot
        :model-value="multiple ? keys : keys[0]"
        :multiple="multiple"
        :disabled="disabled"
        @update:model-value="update"
        @update:open="onOpen"
      >
        <ComboboxAnchor as-child>
          <ComboboxTrigger
            :id="id"
            class="yayaw-select-trigger yayaw-form-select"
            role="combobox"
            data-searchable-field=""
            :aria-labelledby="labelledBy"
            :aria-describedby="describedBy"
            :aria-invalid="invalid || undefined"
            :aria-required="required || undefined"
          >
            <span class="yayaw-form-select-value" :data-placeholder="multiple || !selected.length ? '' : undefined">
              {{ multiple || !selected.length ? placeholder : labelOf(selected[0]) }}
            </span>
            <span v-if="multiple && selected.length" class="yayaw-inline-chip yayaw-field-combobox-count">{{ selected.length }}</span>
            <ChevronDown :size="16" aria-hidden="true" />
          </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
          <ComboboxContent
            class="yayaw-inline-options"
            :style="overlayStyle"
            position="popper"
            align="start"
            :side-offset="4"
            :collision-padding="8"
          >
            <ComboboxInput
              v-model="query"
              class="yayaw-input yayaw-field-combobox-search"
              :aria-label="`${label} ${text('searchOptions')}`"
              :placeholder="text('searchOptions')"
              :auto-focus="true"
              autocomplete="off"
            />
            <ComboboxEmpty class="yayaw-inline-empty">{{ text("noMatchingOption") }}</ComboboxEmpty>
            <ComboboxItem
              v-for="option in items"
              :key="optionControlKey(option.value)"
              :value="optionControlKey(option.value)"
              :text-value="option.label"
              :disabled="option.disabled"
              class="yayaw-inline-option"
            >
              {{ option.label }}
              <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
      <button
        v-if="!multiple && selected.length"
        type="button"
        class="yayaw-icon-button"
        :aria-label="removeLabel(selected[0])"
        :disabled="disabled"
        @click="remove(selected[0])"
      >
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <ul v-if="multiple && selected.length" class="yayaw-inline-chips yayaw-field-combobox-chips">
      <li v-for="value in selected" :key="optionControlKey(value)" class="yayaw-inline-chip">
        {{ labelOf(value) }}
        <button type="button" :aria-label="removeLabel(value)" :disabled="disabled" @click="remove(value)">
          <X :size="12" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
