<script setup lang="ts">
import OptionIcon from "../OptionIcon.vue";
import { Check, ChevronDown, X } from "lucide-vue-next";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from "reka-ui";
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useRemoteOptionSearch, type RemoteOptionSearch } from "../../composables/use-remote-option-search";
import { useTableTranslation } from "../../context";
import { createTranslations } from "../../translations";
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import { formLabel } from "../../form-view";
import { filterMenuText } from "../../filter-menu";
import { limitOptions, optionControlKey, optionControlValue } from "../../table-contracts";
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
  search?: RemoteOptionSearch;
  searchScope?: string;
  loading?: boolean;
  loadError?: string;
  retry?: () => unknown;
}>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const opened = ref(false);
const empty = (value: unknown) => value === undefined || value === null || value === "";
const selected = computed<unknown[]>(() =>
  (props.multiple && Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]).filter(
    (value) => !empty(value)
  )
);
const {
  query, choices: items, matches, searching, resolving, creating, searchError, resolveError, createError,
  canCreate, createText, createOption, retry: retryRemote,
} = useRemoteOptionSearch({
  options: () => props.options,
  selected: () => selected.value,
  search: () => props.search,
  enabled: () => !props.disabled,
  scope: () => props.searchScope,
});
const translate = useTableTranslation();
const CREATE_KEY = "__yayaw-create-option__";
const createLabel = computed(() => translate("inline.create_option", String(createTranslations(props.locale)["inline.create_option"])).replace("{label}", createText.value));
const pending = computed(() => props.loading || searching.value || resolving.value || creating.value);
const optionError = computed(() => props.loadError || searchError.value || resolveError.value || createError.value);
const retry = (): void => {
  if (props.loadError) props.retry?.();
  retryRemote();
};
const folded = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
// The label contains the search, ignoring case and accents; only the first matches are drawn.
const shown = computed(() => {
  const text = folded(query.value.trim());
  if (props.search && text.length >= Math.max(1, props.search.minLength)) return limitOptions(matches.value);
  return limitOptions(text ? items.value.filter((option) => folded(option.label).includes(text)) : items.value);
});
const moreText = computed(() =>
  filterMenuText("moreOptions", props.locale).replace("{count}", String(shown.value.hidden))
);
const optionOf = (value: unknown) => items.value.find((option) => Object.is(option.value, value));
const labelOf = (value: unknown) => optionOf(value)?.label ?? String(value);
const keys = computed(() => selected.value.map(optionControlKey));
const text = (key: "noMatchingOption" | "searchOptions") => formLabel(key, props.locale);
const removeLabel = (value: unknown) =>
  formLabel("removeOption", props.locale, undefined, { label: labelOf(value) });
const chooseCreated = async (): Promise<void> => {
  const option = await createOption();
  if (!option) return;
  emit("update:modelValue", props.multiple
    ? [...selected.value.filter(value => !Object.is(value, option.value)), option.value]
    : option.value);
  if (!props.multiple) onOpen(false);
};
const update = (value: unknown): void => {
  if (props.disabled) return;
  if (value === CREATE_KEY || (Array.isArray(value) && value.includes(CREATE_KEY))) {
    void chooseCreated();
    return;
  }
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
  if (!open && creating.value) return;
  opened.value = open;
  updateOpen(open);
  if (!open) query.value = "";
};
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/**
 * The search and options are portaled to the end of the page: the browser's Tab would leave the form (in a dialog,
 * for its first element, the close button). Tab goes on to the field after this one, Shift+Tab back to this one.
 */
const onSearchTab = async (event: KeyboardEvent): Promise<void> => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  const trigger = document.getElementById(props.id);
  onOpen(false);
  await nextTick();
  if (!trigger) return;
  if (event.shiftKey) { trigger.focus(); return; }
  const scope = trigger.closest('form, [role="dialog"], [role="alertdialog"]') ?? document.body;
  // checkVisibility leaves out hidden fields; where it is missing (older browsers, test DOMs) every field counts.
  const list = [...scope.querySelectorAll<HTMLElement>(TABBABLE)].filter((element) => element.checkVisibility?.() ?? true);
  // The field's own buttons (clear, remove a chip) are skipped: Tab goes to the next field.
  const field = trigger.closest(".yayaw-field-combobox") ?? trigger;
  const next = list.slice(list.indexOf(trigger) + 1).find((element) => !field.contains(element));
  (next ?? trigger).focus();
};
/**
 * Cmd/Ctrl+Enter in the search (portaled, outside the form) closes the list and hands the shortcut to the field,
 * inside the form: the form saves as it does from any field (CatalogueForm).
 */
const onSearchSubmit = (event: KeyboardEvent): void => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing) return;
  const trigger = document.getElementById(props.id);
  if (!trigger) return;
  event.preventDefault();
  onOpen(false);
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: event.ctrlKey, metaKey: event.metaKey, bubbles: true, cancelable: true }));
};
</script>

<template>
  <div ref="anchor" class="yayaw-field-select yayaw-field-combobox">
    <div class="yayaw-field-combobox-row">
      <ComboboxRoot
        :open="opened"
        :model-value="multiple ? keys : keys[0]"
        :multiple="multiple"
        :disabled="disabled"
        :ignore-filter="true"
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
              <OptionIcon v-if="!multiple && selected.length" class="yayaw-option-icon-spaced" :option="optionOf(selected[0])" />
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
            :aria-busy="pending || undefined"
            :aria-label="label"
          >
            <ComboboxInput
              v-model="query"
              :display-value="() => ''"
              class="yayaw-input yayaw-field-combobox-search"
              :aria-label="`${label} ${text('searchOptions')}`"
              :placeholder="text('searchOptions')"
              :auto-focus="true"
              autocomplete="off"
              @keydown.tab="onSearchTab"
              @keydown.enter="onSearchSubmit"
            />
            <div v-if="optionError" class="yayaw-inline-empty" role="alert">
              {{ optionError }}
              <button type="button" class="yayaw-button yayaw-button-outline" @click="retry">{{ translate("retry", locale.startsWith("fr") ? "Réessayer" : "Retry") }}</button>
            </div>
            <div v-else-if="pending" class="yayaw-inline-empty" role="status">{{ translate("loading", formLabel("loading", locale)) }}</div>
            <div v-else-if="!shown.shown.length && !canCreate" class="yayaw-inline-empty" role="status">{{ text("noMatchingOption") }}</div>
            <ComboboxItem
              v-for="option in shown.shown"
              :key="optionControlKey(option.value)"
              :value="optionControlKey(option.value)"
              :text-value="option.label"
              :disabled="option.disabled"
              class="yayaw-inline-option"
            >
              <OptionIcon :option="option" />
              {{ option.label }}
              <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
            </ComboboxItem>
            <ComboboxItem v-if="canCreate" :value="CREATE_KEY" :text-value="createLabel" :disabled="creating" class="yayaw-inline-option" @select.prevent="chooseCreated">
              {{ creating ? translate("loading", formLabel("loading", locale)) : createLabel }}
            </ComboboxItem>
            <p v-if="shown.hidden" class="yayaw-inline-empty" role="status">{{ moreText }}</p>
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
        <OptionIcon :option="optionOf(value)" />
        {{ labelOf(value) }}
        <button type="button" :aria-label="removeLabel(value)" :disabled="disabled" @click="remove(value)">
          <X :size="12" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
