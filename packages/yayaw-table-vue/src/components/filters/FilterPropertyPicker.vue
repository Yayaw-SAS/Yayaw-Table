<script setup lang="ts">
import { Calendar, CircleDot, Hash, List, ListFilterPlus, MapPin, Tags, Type } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import { filterMenuText, filterPropertyCounts, type FilterMenuTextKey, type FilterMenuType } from "../../filter-menu";

/** The properties a new filter can use, searchable; "Add advanced filter" below. */
withDefaults(defineProps<{ advanced?: boolean }>(), { advanced: true });
const emit = defineEmits<{ pick: [columnId: string]; advanced: [] }>();
const context = useTableContext();
const menu = context.filterMenu;
const counts = computed(() => filterPropertyCounts(menu.rules.value));
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const query = ref("");
const visible = computed(() => {
  const search = query.value.trim().toLocaleLowerCase();
  return menu.columns.value.filter((column) => !search || column.header.toLocaleLowerCase().includes(search));
});
const ICONS: Record<FilterMenuType, unknown> = {
  text: Type, number: Hash, date: Calendar, select: CircleDot, multiSelect: Tags, boolean: CircleDot, location: MapPin,
};
const icon = (columnId: string) => ICONS[menu.typeOf(menu.columns.value.find((column) => column.id === columnId))] ?? List;
const input = ref<HTMLInputElement>();
onMounted(() => input.value?.focus());
const first = (): void => {
  const column = visible.value[0];
  if (column) emit("pick", column.id);
};
</script>

<template>
  <div class="yayaw-property-picker" data-filter-property-picker="">
    <input ref="input" v-model="query" type="search" class="yayaw-input" :placeholder="text('filterBy')" :aria-label="text('filterBy')" autocomplete="off" @keydown.enter.prevent="first" />
    <div class="yayaw-property-list" role="group" :aria-label="text('property')">
      <button v-for="column in visible" :key="column.id" type="button" class="yayaw-menu-choice" :data-filter-property="column.id" @click="emit('pick', column.id)">
        <component :is="icon(column.id)" :size="15" aria-hidden="true" />
        <span>{{ column.header }}</span>
        <span v-if="counts[column.id]" class="yayaw-options-item-end yayaw-options-item-count" :data-filter-property-count="column.id">{{ counts[column.id] }}</span>
      </button>
      <p v-if="!visible.length" class="yayaw-help" role="status">{{ text('noProperties') }}</p>
    </div>
    <button v-if="advanced" type="button" class="yayaw-menu-choice yayaw-property-advanced" data-filter-add-advanced="" @click="emit('advanced')">
      <ListFilterPlus :size="15" aria-hidden="true" /><span>{{ text('addAdvanced') }}</span>
    </button>
  </div>
</template>
