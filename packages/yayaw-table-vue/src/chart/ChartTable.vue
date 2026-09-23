<script setup lang="ts">
import type { ChartCategory, ChartLabelKey, ChartModel } from "../chart-model";

const props = defineProps<{
  model: ChartModel;
  clickable: boolean;
  label: (key: ChartLabelKey, params?: Record<string, number | string>) => string;
}>();
const emit = defineEmits<{ group: [category: ChartCategory] }>();
</script>

<template>
  <div class="yayaw-chart-table-wrap">
    <table class="yayaw-chart-table" data-chart-table>
      <caption class="yayaw-sr-only">{{ props.model.title }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ props.model.xLabel || props.label("group") }}</th>
          <th v-for="item in props.model.series" :key="item.id" scope="col" class="yayaw-chart-number">
            {{ props.model.single ? props.model.valueLabel : item.label }}
          </th>
          <th v-if="!props.model.single" scope="col" class="yayaw-chart-number">{{ props.label("total") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="category in props.model.categories" :key="category.id">
          <th scope="row">
            <button
              v-if="props.clickable && !category.other"
              type="button"
              class="yayaw-chart-link"
              :aria-label="props.label('showRecords', { group: category.label })"
              @click="emit('group', category)"
            >
              {{ category.label }}
            </button>
            <template v-else>{{ category.label }}</template>
          </th>
          <td v-for="item in props.model.series" :key="item.id" class="yayaw-chart-number">
            {{ props.model.format(category.values[item.id] ?? 0) }}
          </td>
          <td v-if="!props.model.single" class="yayaw-chart-number yayaw-chart-strong">
            {{ props.model.format(category.total) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
