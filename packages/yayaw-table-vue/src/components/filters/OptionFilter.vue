<script setup lang="ts">
import OptionIcon from "../OptionIcon.vue";
import { computed, ref } from "vue";
import { ChevronDown, Filter } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useRemoteFilterOptions } from "../../composables/use-remote-filter-options";
import { useTableContext, useTableTranslation } from "../../context";
import { filterBarOptions, filterValueKey, filterValues, replaceColumnFilter } from "../../filter-bar";
import { filterMenuText, type FilterMenuTextKey } from "../../filter-menu";
import { limitOptions } from "../../table-contracts";
import type { ColumnDefinition } from "../../types";

/** Up to this many choices, a single-choice filter shows them without a search field. */
const SINGLE_CHOICE_SEARCH_THRESHOLD = 8;

const props = defineProps<{ column: ColumnDefinition }>();
const context = useTableContext();
const translate = useTableTranslation();
const menuText = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, (name) => {
  const value = context.translations.value[name];
  return typeof value === "string" ? value : undefined;
});
const search = ref("");
const open = ref(false);
const remote = useRemoteFilterOptions({
  column: () => props.column, search, remember: context.filterMenu.rememberOptions, enabled: () => open.value,
});
const value = computed(() => context.state.filters.value.find(filter => filter.id === props.column.id)?.value);
const selected = computed(() => filterValues(value.value));
const checked = (candidate: unknown): boolean => selected.value.some(item => filterValueKey(item) === filterValueKey(candidate));
const options = computed(() => filterBarOptions(
  { ...props.column, options: [...(props.column.options ?? []), ...remote.loaded.value] },
  value.value,
  { yes: translate("common.true", "True"), no: translate("common.false", "False") },
  context.filterMenu.resolvedOptions.value[props.column.id],
));
const limited = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  const remoteValues = new Set(remote.loaded.value.map(option => filterValueKey(option.value)));
  // Server results may match other fields; retain those and selections while searching static labels.
  return limitOptions(options.value.filter(option => option.label.toLocaleLowerCase().includes(query)
    || (props.column.optionsLoader && (checked(option.value) || remoteValues.has(filterValueKey(option.value))))));
});
const visibleOptions = computed(() => limited.value.shown);
const status = computed(() => {
  if (remote.loading.value) return menuText("loadingOptions");
  if (remote.failed.value) return menuText("optionsError");
  if (props.column.optionsLoader && search.value.trim().length < remote.minimum.value) {
    return menuText("searchMinimum").replace("{count}", String(remote.minimum.value));
  }
  if (limited.value.hidden) return menuText("moreOptions").replace("{count}", String(limited.value.hidden));
  return visibleOptions.value.length ? "" : translate("noResults", "No results");
});
const toggleOpen = (next: boolean): void => {
  open.value = next;
  search.value = "";
};
const update = (next: unknown): void => {
  context.state.filters.value = replaceColumnFilter(context.state.filters.value, props.column.id, next);
};
const single = computed(() => props.column.filterSelection === "single");
const selectedOption = computed(() => single.value ? options.value.find(option => checked(option.value)) : undefined);
const current = computed(() => single.value && selected.value.length
  ? selectedOption.value?.label ?? String(selected.value[0])
  : undefined);
const searchable = computed(() => !single.value || Boolean(props.column.optionsLoader) || options.value.length > SINGLE_CHOICE_SEARCH_THRESHOLD);
const radioName = computed(() => `${context.config.id}-${props.column.id}-quick-filter`);
const pick = (candidate: unknown): void => {
  update(candidate);
  toggleOpen(false);
};
const toggle = (candidate: unknown): void => update(checked(candidate)
  ? selected.value.filter(item => filterValueKey(item) !== filterValueKey(candidate))
  : [...selected.value, candidate]);
</script>

<template>
  <PopoverRoot :open="open" @update:open="toggleOpen">
    <PopoverTrigger as-child>
      <button type="button" class="yayaw-button yayaw-button-outline yayaw-filter-trigger" :aria-label="column.header" :data-active="selected.length ? '' : undefined">
        <Filter :size="16" aria-hidden="true" />
        <span>{{ column.header }}<template v-if="current !== undefined">: <span class="yayaw-filter-current"><OptionIcon class="yayaw-option-icon-spaced" :option="selectedOption" />{{ current }}</span></template></span>
        <span v-if="!single && selected.length" class="yayaw-filter-count">{{ selected.length }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="yayaw-filter-picker" :data-yayaw-filter-picker="context.config.id" :aria-label="column.header" align="start" :side-offset="4" :collision-padding="8">
        <p class="yayaw-filter-heading">{{ column.header }}</p>
        <input v-if="searchable" v-model="search" type="search" class="yayaw-input" :aria-label="translate('searchOptions', 'Search options…')" :placeholder="translate('searchOptions', 'Search options…')" autocomplete="off" />
        <div v-if="single" class="yayaw-filter-choices" role="radiogroup" :aria-label="column.header">
          <label class="yayaw-filter-choice yayaw-filter-all">
            <input type="radio" :name="radioName" :checked="!selected.length" @change="pick([])" />
            <span>{{ menuText('all') }}</span>
          </label>
          <label v-for="option in visibleOptions" :key="filterValueKey(option.value)" class="yayaw-filter-choice">
            <input type="radio" :name="radioName" :checked="checked(option.value)" :disabled="option.disabled" @change="pick(option.value)" />
            <OptionIcon :option="option" />
            <span>{{ option.label }}</span>
          </label>
          <p v-if="status" class="yayaw-help" role="status">{{ status }}</p>
        </div>
        <div v-else class="yayaw-filter-choices" role="group" :aria-label="column.header">
          <label v-for="option in visibleOptions" :key="filterValueKey(option.value)" class="yayaw-filter-choice">
            <input type="checkbox" :checked="checked(option.value)" :disabled="option.disabled" @change="toggle(option.value)" />
            <OptionIcon :option="option" />
            <span>{{ option.label }}</span>
          </label>
          <p v-if="status" class="yayaw-help" role="status">{{ status }}</p>
        </div>
        <button v-if="!single" type="button" class="yayaw-button yayaw-button-outline" :disabled="!selected.length" @click="update([])">{{ translate('clearFilters', 'Clear filters') }}</button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
