<script setup lang="ts">
import {
  type ChartCategory,
  type ChartLabelKey,
  type ChartModel,
  chartValueText,
} from "../chart-model";

const props = defineProps<{
  model: ChartModel;
  clickable: boolean;
  label: (key: ChartLabelKey, params?: Record<string, number | string>) => string;
}>();
const emit = defineEmits<{ group: [category: ChartCategory] }>();
// Funnels list each stage's value, share of the first stage and conversion.
const percent = (share: number | undefined): string =>
  share === undefined ? "—" : props.model.formatShare(share);
</script>

<template>
  <div class="yayaw-chart-table-wrap">
    <table v-if="props.model.type === 'funnel'" class="yayaw-chart-table" data-chart-table>
      <caption class="yayaw-sr-only">{{ props.model.title }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ props.label("stage") }}</th>
          <th scope="col" class="yayaw-chart-number">{{ props.model.valueLabel }}</th>
          <th scope="col" class="yayaw-chart-number">{{ props.label("shareOfFirst") }}</th>
          <th scope="col" class="yayaw-chart-number">{{ props.label("conversion") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stage in props.model.stages ?? []" :key="stage.id">
          <th scope="row">
            <button
              v-if="props.clickable"
              type="button"
              class="yayaw-chart-link"
              :aria-label="props.label('showRecords', { group: stage.label })"
              @click="emit('group', stage.category)"
            >
              {{ stage.label }}
            </button>
            <template v-else>{{ stage.label }}</template>
          </th>
          <td class="yayaw-chart-number">{{ stage.valueText }}</td>
          <td class="yayaw-chart-number">{{ percent(stage.shareOfFirst) }}</td>
          <td class="yayaw-chart-number">{{ percent(stage.conversion) }}</td>
        </tr>
      </tbody>
    </table>
    <table v-else class="yayaw-chart-table" data-chart-table>
      <caption class="yayaw-sr-only">{{ props.model.title }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ props.model.xLabel || props.label("group") }}</th>
          <th v-for="item in props.model.series" :key="item.id" scope="col" class="yayaw-chart-number">
            {{ props.model.single ? props.model.valueLabel : item.label }}
          </th>
          <th v-if="props.model.totalColumn" scope="col" class="yayaw-chart-number">{{ props.label("total") }}</th>
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
            {{ chartValueText(props.model, category, item) }}
          </td>
          <td v-if="props.model.totalColumn" class="yayaw-chart-number yayaw-chart-strong">
            {{ props.model.format(category.total) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
