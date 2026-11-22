<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { Check, X } from "lucide-vue-next";
import {
  ComboboxAnchor, ComboboxContent, ComboboxInput,
  ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot,
} from "reka-ui";
import { useTableContext, useTableTranslation } from "../../context";
import { filterMenuText } from "../../filter-menu";
import { limitOptions, optionControlKey as keyFor } from "../../table-contracts";
import { useRemoteOptionSearch, type RemoteOptionSearch } from "../../composables/use-remote-option-search";
import type { SelectOption } from "../../types";

export type InlineOptionSearch = RemoteOptionSearch;

const props = withDefaults(defineProps<{
  modelValue: unknown;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
  multiple?: boolean;
  search?: InlineOptionSearch;
}>(), { multiple: true });
const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  commit: [];
  cancel: [];
}>();
const translate = useTableTranslation();
const anchor = ref<HTMLElement>();
const selected = computed<unknown[]>(() => {
  if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue : [];
  return props.modelValue == null || props.modelValue === "" ? [] : [props.modelValue];
});
const {
  query, choices: remoteChoices, matches, searching, resolving, searchError, resolveError,
  creating, createError, createText, canCreate: createsOption, createOption: persistOption,
} = useRemoteOptionSearch({
  options: () => props.options,
  selected: () => selected.value,
  search: () => props.search,
  enabled: () => !props.disabled,
});
const choices = computed(() => remoteChoices.value.map(option => ({ ...option, key: keyFor(option.value) })));
// Inline editing retains known label matches alongside the server's matches.
const limited = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  const matched = new Set(matches.value.map(option => keyFor(option.value)));
  return limitOptions(text ? choices.value.filter(option => matched.has(option.key) || option.label.toLocaleLowerCase().includes(text)) : choices.value);
});
const visible = computed(() => limited.value.shown);
const context = useTableContext();
const moreText = computed(() => filterMenuText("moreOptions", context.locale, (name) => {
  const value = context.translations.value[name];
  return typeof value === "string" ? value : undefined;
}).replace("{count}", String(limited.value.hidden)));
const selectedKeys = computed(() => selected.value.map(keyFor));
const selectedOptions = computed(() => selectedKeys.value.map(key => choices.value.find(option => option.key === key)!));
const update = (value: string | string[] | null | undefined): void => {
  const keys = Array.isArray(value) ? value : value == null ? [] : [value];
  if (keys.includes(CREATE_KEY)) {
    void createOption();
    return;
  }
  const values = keys.map(key => choices.value.find(option => option.key === key)!.value);
  if (props.multiple) {
    emit("update:modelValue", values);
    return;
  }
  emit("update:modelValue", values[0] ?? null);
  // A single choice is the whole edit, as with a select.
  emit("commit");
};
const remove = (key: string): void => {
  if (props.disabled || choices.value.find(option => option.key === key)?.disabled) return;
  update(props.multiple ? selectedKeys.value.filter(value => value !== key) : []);
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
  } else if (event.key === "Backspace" && props.multiple && !query.value && selectedOptions.value.length) {
    event.preventDefault();
    const last = selectedOptions.value.at(-1)!;
    remove(last.key);
  }
};
// The list entry that creates an option from the search text.
const CREATE_KEY = "__yayaw-create-option__";
const createLabel = computed(() =>
  translate("inline.create_option", 'Create "{label}"').replace("{label}", createText.value)
);
const createOption = async (): Promise<void> => {
  const option = await persistOption();
  if (!option) return;
  if (props.multiple) {
    emit("update:modelValue", [...selected.value.filter(value => keyFor(value) !== keyFor(option.value)), option.value]);
    anchor.value?.querySelector("input")?.focus();
    return;
  }
  emit("update:modelValue", option.value);
  emit("commit");
};
const emptyText = computed(() => {
  if (createError.value) return createError.value;
  if (searchError.value) return searchError.value;
  if (resolveError.value) return resolveError.value;
  if (searching.value || resolving.value) return translate("loading", "Loading…");
  return translate("filters.noResults", "No results");
});
// Keep the editor open until the parent acknowledges dismissal and saves its draft.
// A single choice closes the list before it reports the value: commit after it.
const dismiss = (open: boolean): void => {
  if (open) return;
  // A creation in progress keeps the editor, so the app can show its own form over it.
  if (props.multiple) {
    if (!creating.value) emit("commit");
    return;
  }
  // Picking "Create …" closes a single list too: the creation commits once it is saved.
  void nextTick(() => { if (!creating.value) emit("commit"); });
};
onMounted(async () => {
  await nextTick();
  anchor.value?.querySelector("input")?.focus();
});
</script>

<template>
  <div ref="anchor" class="yayaw-inline-multiselect">
  <!-- A single list with nothing chosen gets null, never undefined: Reka then stays controlled and reports the first pick. -->
  <ComboboxRoot :multiple="multiple" :open="true" :model-value="multiple ? selectedKeys : (selectedKeys[0] ?? null)" :disabled="disabled" :ignore-filter="true" @update:model-value="update" @update:open="dismiss">
    <!-- Mount the list before the input so Reka assigns aria-controls on first render. -->
    <ComboboxPortal force-mount>
      <ComboboxContent class="yayaw-inline-options" position="popper" align="start" :side-offset="6" :collision-padding="8" :aria-label="label" :aria-busy="disabled || searching || resolving" @escape-key-down.prevent="emit('cancel')">
        <div v-if="search && ((!visible.length && !createsOption) || searchError || createError || resolveError || searching || resolving)" class="yayaw-inline-empty" :role="searchError || createError || resolveError ? 'alert' : 'status'">{{ emptyText }}</div>
        <div v-else-if="!search && !visible.length" class="yayaw-inline-empty" role="status">{{ emptyText }}</div>
        <ComboboxItem v-for="option in visible" :key="option.key" :value="option.key" :text-value="option.label" :disabled="option.disabled" class="yayaw-inline-option">
          {{ option.label }}
          <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
        </ComboboxItem>
        <ComboboxItem v-if="createsOption" :value="CREATE_KEY" :text-value="createLabel" :disabled="creating" class="yayaw-inline-option" @select.prevent="createOption">
          {{ creating ? translate("loading", "Loading…") : createLabel }}
        </ComboboxItem>
        <p v-if="limited.hidden" class="yayaw-inline-empty" role="status">{{ moreText }}</p>
      </ComboboxContent>
    </ComboboxPortal>
    <ComboboxAnchor as-child>
      <div class="yayaw-inline-editor yayaw-inline-selection">
        <div class="yayaw-inline-chips">
        <span v-for="option in selectedOptions" :key="option.key" class="yayaw-inline-chip">
          {{ option.label }}
          <button v-if="!option.disabled" type="button" :aria-label="`${translate('remove', 'Remove')} ${option.label}`" :disabled="disabled || option.disabled" @click.stop="remove(option.key)"><X :size="12" aria-hidden="true" /></button>
        </span>
        </div>
        <ComboboxInput v-model="query" :display-value="() => ''" class="yayaw-inline-search" :aria-label="label" :placeholder="selected.length ? undefined : translate('inline.select_no_options', 'Select an option')" autocomplete="off" @keydown="onKeydown" />
      </div>
    </ComboboxAnchor>

  </ComboboxRoot>
  </div>
</template>
