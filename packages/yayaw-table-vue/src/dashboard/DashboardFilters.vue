<script setup lang="ts">
import { X } from "lucide-vue-next";
import {
  type DashboardDateRange,
  type DashboardFilter,
  type DashboardTableInfo,
  dashboardFilterOptions,
  dashboardFilterTargetsLabel,
  isDashboardFilterActive,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** The dashboard's filters; each joins the widgets it targets. */
const props = defineProps<{
  filters: DashboardFilter[];
  tables: Record<string, DashboardTableInfo>;
  editing: boolean;
  label: DashboardLabel;
}>();
const emit = defineEmits<{
  change: [filterId: string, value: DashboardDateRange | string[] | undefined];
  remove: [filterId: string];
  add: [];
}>();

const rangeOf = (filter: DashboardFilter): DashboardDateRange =>
  (filter.value && !Array.isArray(filter.value) ? filter.value : {}) as DashboardDateRange;
const updateRange = (filter: DashboardFilter, part: "start" | "end", value: string) =>
  emit("change", filter.id, { ...rangeOf(filter), [part]: value || undefined });
const selected = (filter: DashboardFilter): string =>
  Array.isArray(filter.value) ? (filter.value[0] ?? "") : "";
const choose = (filter: DashboardFilter, value: string) =>
  emit("change", filter.id, value ? [value] : undefined);
</script>

<template>
  <section
    v-if="props.filters.length || props.editing"
    class="yayaw-dashboard-filters"
    :aria-label="props.label('filters')"
    data-dashboard-filters=""
  >
    <fieldset v-for="filter in props.filters" :key="filter.id" class="yayaw-dashboard-filter" :data-dashboard-filter="filter.id">
      <legend>
        {{ filter.label }}
        <button
          v-if="props.editing"
          type="button"
          class="yayaw-dashboard-icon-button"
          data-size="xs"
          :aria-label="props.label('removeFilter', { name: filter.label })"
          @click="emit('remove', filter.id)"
        >
          <X :size="12" aria-hidden="true" />
        </button>
      </legend>
      <div class="yayaw-dashboard-filter-row">
        <template v-if="filter.type === 'dateRange'">
          <input
            type="date"
            class="yayaw-input"
            data-filter-part="start"
            :aria-label="`${filter.label}: ${props.label('from')}`"
            :value="rangeOf(filter).start ?? ''"
            @input="updateRange(filter, 'start', ($event.target as HTMLInputElement).value)"
          >
          <span aria-hidden="true" class="yayaw-dashboard-muted">–</span>
          <input
            type="date"
            class="yayaw-input"
            data-filter-part="end"
            :aria-label="`${filter.label}: ${props.label('to')}`"
            :value="rangeOf(filter).end ?? ''"
            @input="updateRange(filter, 'end', ($event.target as HTMLInputElement).value)"
          >
        </template>
        <select
          v-else
          class="yayaw-select"
          :aria-label="filter.label"
          :value="selected(filter)"
          @change="choose(filter, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ props.label("any") }}</option>
          <option v-for="option in dashboardFilterOptions(filter, props.tables)" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button
          v-if="isDashboardFilterActive(filter)"
          type="button"
          class="yayaw-button yayaw-button-ghost"
          @click="emit('change', filter.id, undefined)"
        >
          {{ props.label("clear") }}
        </button>
      </div>
      <p class="yayaw-dashboard-targets" data-filter-targets="">
        {{ props.label("appliesTo", { targets: dashboardFilterTargetsLabel(filter, props.tables) }) }}
      </p>
    </fieldset>
    <button v-if="props.editing" type="button" class="yayaw-button yayaw-button-outline" @click="emit('add')">
      {{ props.label("addFilter") }}
    </button>
  </section>
</template>
