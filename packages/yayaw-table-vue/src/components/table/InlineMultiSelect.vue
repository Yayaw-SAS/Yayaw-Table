<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Check, X } from "lucide-vue-next";
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot,
} from "reka-ui";
import { useTableTranslation } from "../../context";
import type { MaybePromise, SelectOption } from "../../types";

/** Server-side choices of a form field with `searchOptions`, already bound to the cell's form context. */
export interface InlineOptionSearch {
  search: (query: string, signal: AbortSignal) => MaybePromise<SelectOption[]>;
  resolve?: (values: unknown[], signal: AbortSignal) => MaybePromise<SelectOption[]>;
  minLength: number;
  debounceMs: number;
}

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
const query = ref("");
const anchor = ref<HTMLElement>();
const selected = computed<unknown[]>(() => {
  if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue : [];
  return props.modelValue == null || props.modelValue === "" ? [] : [props.modelValue];
});
// Typed keys keep numeric, boolean and string catalogue IDs distinct.
const keyFor = (value: unknown): string => `${typeof value}:${String(value)}`;
// Searched and resolved options stay known, so a choice keeps its label after the next search.
const remote = ref<SelectOption[]>([]);
const matched = ref<Set<string>>();
const searching = ref(false);
const searchError = ref<string>();
const choices = computed(() => {
  const result = new Map([...props.options, ...remote.value].map(option => [keyFor(option.value), { ...option, key: keyFor(option.value) }]));
  for (const value of selected.value) {
    const key = keyFor(value);
    if (!result.has(key)) result.set(key, { label: String(value), value: value as SelectOption["value"], key });
  }
  return [...result.values()];
});
// With a server search, the server decides what matches: its results show even when the label lacks the text.
const visible = computed(() => {
  const text = query.value.trim().toLocaleLowerCase();
  if (!(props.search && text)) return choices.value;
  return choices.value.filter(option => matched.value?.has(option.key) || option.label.toLocaleLowerCase().includes(text));
});
const selectedKeys = computed(() => selected.value.map(keyFor));
const selectedOptions = computed(() => selectedKeys.value.map(key => choices.value.find(option => option.key === key)!));
const remember = (options: SelectOption[]): void => {
  const known = new Set(remote.value.map(option => keyFor(option.value)));
  remote.value = [...remote.value, ...options.filter(option => !known.has(keyFor(option.value)))];
};
let request: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
const stopSearch = (): void => {
  request?.abort();
  if (timer) clearTimeout(timer);
  searching.value = false;
};
const runSearch = async (text: string): Promise<void> => {
  const current = new AbortController();
  request = current;
  searching.value = true;
  searchError.value = undefined;
  try {
    const found = await props.search!.search(text, current.signal);
    if (current.signal.aborted) return;
    remember(found);
    matched.value = new Set(found.map(option => keyFor(option.value)));
  } catch (cause) {
    if (!current.signal.aborted) searchError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (!current.signal.aborted) searching.value = false;
  }
};
watch(query, (value) => {
  if (!props.search) return;
  stopSearch();
  matched.value = undefined;
  searchError.value = undefined;
  const text = value.trim();
  if (text.length < Math.max(1, props.search.minLength)) return;
  searching.value = true;
  timer = setTimeout(() => void runSearch(text), Math.max(0, props.search.debounceMs));
});
const resolveSelection = async (): Promise<void> => {
  const missing = selected.value.filter(value => !props.options.some(option => keyFor(option.value) === keyFor(value)));
  if (!(missing.length && props.search?.resolve)) return;
  try {
    remember(await props.search.resolve(missing, new AbortController().signal));
  } catch {
    // The raw value stays shown; saving does not depend on its label.
  }
};
const update = (value: string | string[] | null | undefined): void => {
  const keys = Array.isArray(value) ? value : value == null ? [] : [value];
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
const emptyText = computed(() => {
  if (searchError.value) return searchError.value;
  if (searching.value) return translate("loading", "Loading…");
  return translate("filters.noResults", "No results");
});
// Keep the editor open until the parent acknowledges dismissal and saves its draft.
// A single choice closes the list before it reports the value: commit after it.
const dismiss = (open: boolean): void => {
  if (open) return;
  if (props.multiple) emit("commit");
  else void nextTick(() => emit("commit"));
};
onMounted(async () => {
  void resolveSelection();
  await nextTick();
  anchor.value?.querySelector("input")?.focus();
});
onBeforeUnmount(stopSearch);
</script>

<template>
  <div ref="anchor" class="yayaw-inline-multiselect">
  <ComboboxRoot :multiple="multiple" :open="true" :model-value="multiple ? selectedKeys : selectedKeys[0]" :disabled="disabled" :ignore-filter="Boolean(search)" @update:model-value="update" @update:open="dismiss">
    <!-- Mount the list before the input so Reka assigns aria-controls on first render. -->
    <ComboboxPortal force-mount>
      <ComboboxContent class="yayaw-inline-options" position="popper" align="start" :side-offset="6" :collision-padding="8" :aria-label="label" :aria-busy="disabled || searching" @escape-key-down.prevent="emit('cancel')">
        <div v-if="search && (!visible.length || searchError)" class="yayaw-inline-empty" :role="searchError ? 'alert' : 'status'">{{ emptyText }}</div>
        <ComboboxEmpty v-else-if="!search" class="yayaw-inline-empty">{{ emptyText }}</ComboboxEmpty>
        <ComboboxItem v-for="option in visible" :key="option.key" :value="option.key" :text-value="option.label" :disabled="option.disabled" class="yayaw-inline-option">
          {{ option.label }}
          <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
        </ComboboxItem>
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
