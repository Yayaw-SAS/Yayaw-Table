<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useTableContext } from "../../context";
import {
  filterMenuText,
  type FilterMenuTextKey,
  filterOperatorIsMultiple,
  filterOperatorNeedsValue,
} from "../../filter-menu";
import { type FileTreeLabelKey, fileTreeLabel } from "../../filetree-model";
import {
  folderChoiceOf,
  rootFolderLabel,
  toggleFolderChoice,
} from "../../folder-directory";
import { type LocationLabelKey, locationLabel } from "../../location-model";
import { tagSwatchColor } from "../../tag-colors";
import type {
  AdvancedFilter,
  AdvancedFilterOperator,
  ColumnDefinition,
  PrimitiveValue,
  SelectOption,
} from "../../types";
import FolderPicker from "../folders/FolderPicker.vue";
import DateValueEditor from "./DateValueEditor.vue";

/** The value part of a rule's editor, by type; every change updates the rule. */
const props = defineProps<{ rule: AdvancedFilter; column?: ColumnDefinition; autofocus?: boolean }>();
const emit = defineEmits<{ update: [rule: AdvancedFilter] }>();
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const type = computed(() => menu.typeOf(props.column));
const folder = computed(() => menu.isFolderColumn(props.column));
watch(folder, (value) => { if (value) context.folders.use(); }, { immediate: true });
const values = computed<unknown[]>(() =>
  Array.isArray(props.rule.values) ? props.rule.values : props.rule.values === undefined ? [] : [props.rule.values]
);
const multiple = computed(() => filterOperatorIsMultiple(type.value, props.rule.operator));
const set = (next: unknown, operator: string = props.rule.operator): void =>
  emit("update", { ...props.rule, type: type.value, operator: operator as AdvancedFilterOperator, values: next });
const search = ref("");
const loadedOptions = ref<SelectOption[]>([]);
const loadingOptions = ref(false);
const optionsFailed = ref(false);
const searchMinimum = computed(() => Math.max(0, props.column?.optionsSearchMinLength ?? 0));
watch(() => [props.column?.id, props.column?.optionsLoader, search.value.trim()] as const, ([, loader, query], _previous, onCleanup) => {
  const controller = new AbortController();
  optionsFailed.value = false;
  if (!loader || query.length < searchMinimum.value) {
    loadedOptions.value = [];
    loadingOptions.value = false;
    return;
  }
  loadedOptions.value = [];
  loadingOptions.value = true;
  const timer = setTimeout(async () => {
    try {
      const result = await loader(query, controller.signal);
      if (!controller.signal.aborted) { loadedOptions.value = result; menu.rememberOptions(props.column!.id, result); }
    } catch {
      if (!controller.signal.aborted) { loadedOptions.value = []; optionsFailed.value = true; }
    } finally {
      if (!controller.signal.aborted) loadingOptions.value = false;
    }
  }, query ? Math.max(0, props.column?.optionsSearchDebounceMs ?? 300) : 0);
  onCleanup(() => { clearTimeout(timer); controller.abort(); });
}, { immediate: true });
const options = computed(() => {
  const column = props.column;
  const result: SelectOption[] =
    type.value === "boolean" && !column?.options?.length
      ? [
          { label: text("checked"), value: true },
          { label: text("unchecked"), value: false },
        ]
      : [...(column?.options ?? [])];
  for (const option of [...loadedOptions.value]) {
    if (!result.some(item => Object.is(item.value, option.value))) result.push(option);
  }
  const add = (value: unknown) => {
    if (!["string", "number", "boolean"].includes(typeof value) || result.some((option) => Object.is(option.value, value))) return;
    result.push(menu.resolvedOptions.value[props.rule.columnId]?.find(option => Object.is(option.value, value)) ?? { value: value as PrimitiveValue, label: String(value) });
  };
  if (!column?.optionsLoader && !column?.options?.length && type.value !== "boolean") {
    for (const row of context.data.rows.value) {
      const value = column?.accessorFn ? column.accessorFn(row) : row[column?.accessorKey ?? props.rule.columnId];
      for (const item of Array.isArray(value) ? value : [value]) add(item);
    }
  }
  // A selected value can be absent from the current server page's facets.
  for (const value of values.value) add(value);
  return result;
});
const visibleOptions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return query && !props.column?.optionsLoader ? options.value.filter((option) => option.label.toLocaleLowerCase().includes(query)) : options.value;
});
const checked = (option: SelectOption): boolean => values.value.some((value) => Object.is(value, option.value));
const toggle = (option: SelectOption): void => {
  if (!multiple.value) {
    set(checked(option) ? undefined : option.value);
    return;
  }
  set(checked(option) ? values.value.filter((value) => !Object.is(value, option.value)) : [...values.value, option.value]);
};
const tagSwatch = (option: SelectOption) => {
  if (!props.column?.tags) return;
  const color = tagSwatchColor(String(option.value), (props.column.coloredTags ?? context.config.table.coloredTags) !== false, option.color);
  return color ? { "--yayaw-tag-color": color } : undefined;
};
/**
 * Typed values stay on screen while being written and filter once typing
 * pauses, on Enter or on leaving the field, so a server table is not asked
 * for every keystroke ("2", "24", "240"…). Escape brings back the value
 * that filters.
 */
const TYPING_PAUSE_MS = 500;
const committedTexts = (): string[] =>
  [0, 1].map((index) => {
    const value = values.value[index];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  });
const texts = ref<string[]>(committedTexts());
let typing: ReturnType<typeof setTimeout> | undefined;
const parse = (raw: string): unknown => {
  if (type.value !== "number") return raw;
  const value = raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : undefined;
};
const typed = (): unknown =>
  props.rule.operator === "between" ? [parse(texts.value[0] ?? ""), parse(texts.value[1] ?? "")] : parse(texts.value[0] ?? "");
const current = (): unknown => (props.rule.operator === "between" ? [values.value[0], values.value[1]] : values.value[0]);
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
// A value changed elsewhere shows here; "-" or "2." being typed stays.
watch(() => props.rule.values, () => {
  if (!same(typed(), current())) texts.value = committedTexts();
});
const commit = (): void => {
  clearTimeout(typing);
  typing = undefined;
  const next = typed();
  if (!same(next, current())) set(next);
};
const changeInput = (event: Event, index = 0): void => {
  const next = [...texts.value];
  next[index] = (event.target as HTMLInputElement).value;
  texts.value = next;
  clearTimeout(typing);
  typing = setTimeout(commit, TYPING_PAUSE_MS);
};
const discard = (event: KeyboardEvent): void => {
  if (!typing) return;
  clearTimeout(typing);
  typing = undefined;
  texts.value = committedTexts();
  // The value is put back; a second Escape closes the editor.
  event.stopPropagation();
};
onBeforeUnmount(() => { if (typing) commit(); });
const LOCATION_FIELDS: Partial<Record<string, LocationLabelKey[]>> = {
  withinDistance: ["latitude", "longitude", "distance"],
  withinBounds: ["west", "south", "east", "north"],
};
const locationFields = computed(() => LOCATION_FIELDS[props.rule.operator] ?? []);
const locationText = (key: LocationLabelKey): string =>
  locationLabel(key, context.locale, (name, fallback) => translate(`location.${name}`) ?? fallback);
const locationValue = (index: number): string => {
  const value = values.value[index];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
};
const changeLocation = (event: Event, index: number): void => {
  const raw = (event.target as HTMLInputElement).value.trim();
  set(locationFields.value.map((_, position) =>
    position === index ? (raw === "" ? Number.NaN : Number(raw)) : Number(values.value[position] ?? Number.NaN)
  ));
};
const folderLabel = (key: FileTreeLabelKey): string =>
  fileTreeLabel(key, context.locale, (name, fallback) => translate(`filetree.${name}`) ?? fallback);
const folderChoice = computed(() => folderChoiceOf(props.rule));
const pickFolder = (id: string | null): void => {
  const next = toggleFolderChoice(props.rule, id);
  emit("update", { ...props.rule, ...next, type: "select" } as AdvancedFilter);
};
const root = ref<HTMLElement>();
onMounted(() => {
  if (props.autofocus) root.value?.querySelector<HTMLElement>("input:not([type=checkbox]), button[aria-pressed]")?.focus();
});
</script>

<template>
  <div ref="root" class="yayaw-filter-value" :data-filter-type="type">
    <FolderPicker
      v-if="folder"
      :directory="context.folders.directory.value"
      :loading="context.folders.loading.value"
      :label="column?.header ?? folderLabel('folder')"
      :search-label="folderLabel('searchFolders')"
      :loading-label="folderLabel('loading')"
      :empty-label="folderLabel('noFolders')"
      :root-label="rootFolderLabel(context.locale, (name, fallback) => translate(`filetree.${name}`) ?? fallback)"
      :selected="(id) => (id === null ? folderChoice.root : folderChoice.ids.includes(id))"
      @pick="pickFolder"
    />
    <template v-else-if="filterOperatorNeedsValue(rule.operator)">
      <DateValueEditor v-if="type === 'date'" :operator="rule.operator" :values="rule.values" @change="(next) => set(next.values, next.operator)" />
      <template v-else-if="type === 'select' || type === 'multiSelect' || type === 'boolean'">
        <input v-if="column?.optionsLoader || options.length > 6" v-model="search" type="search" class="yayaw-input" :aria-label="text('searchOptions')" :placeholder="text('searchOptions')" autocomplete="off" />
        <div class="yayaw-filter-options-list" role="group" :aria-label="column?.header">
          <label v-for="option in visibleOptions" :key="`${typeof option.value}:${option.value}`" class="yayaw-filter-choice">
            <input type="checkbox" :checked="checked(option)" :disabled="option.disabled" @change="toggle(option)" />
            <span v-if="tagSwatch(option)" class="yayaw-tag-swatch" :style="tagSwatch(option)" aria-hidden="true" />
            <span>{{ option.label }}</span>
          </label>
          <p v-if="loadingOptions || optionsFailed || search.trim().length < searchMinimum" class="yayaw-help" role="status">{{ loadingOptions ? text('loadingOptions') : optionsFailed ? text('optionsError') : text('searchMinimum').replace('{count}', String(searchMinimum)) }}</p>
          <p v-if="!visibleOptions.length && !loadingOptions && !optionsFailed && search.trim().length >= searchMinimum" class="yayaw-help" role="status">{{ text('noOptions') }}</p>
        </div>
      </template>
      <div v-else-if="type === 'location'" class="yayaw-filter-location" :data-location-filter="rule.operator">
        <label v-for="(key, index) in locationFields" :key="key" class="yayaw-field-inline">
          <span>{{ locationText(key) }}</span>
          <input type="number" step="any" inputmode="decimal" class="yayaw-input" :value="locationValue(index)" @input="changeLocation($event, index)" />
        </label>
      </div>
      <div v-else class="yayaw-filter-inputs">
        <input
          v-for="index in rule.operator === 'between' ? 2 : 1"
          :key="index"
          class="yayaw-input"
          :type="type === 'number' ? 'number' : 'text'"
          :step="type === 'number' ? 'any' : undefined"
          :value="texts[index - 1]"
          :placeholder="text('typeValue')"
          :aria-label="index === 2 ? text('to') : text('value')"
          data-filter-input=""
          @input="changeInput($event, index - 1)"
          @keydown.enter.prevent="commit"
          @keydown.esc="discard"
          @blur="commit"
        />
      </div>
    </template>
  </div>
</template>
