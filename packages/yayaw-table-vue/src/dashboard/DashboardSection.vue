<script setup lang="ts">
import { type CSSProperties, useId } from "vue";
import DashboardGrid from "./DashboardGrid.vue";
import { DASHBOARD_MARGIN, type DashboardLayoutItem } from "./dashboard-layout";
import type { DashboardSection } from "./dashboard-schema";

/**
 * A section: its title, then a grid of cards (its own gridstack) or widgets
 * stacked at full width and their natural height (a flow).
 */
const props = defineProps<{
  section: DashboardSection;
  /** The section's title in the dashboard's language; empty shows none. */
  title: string;
  editing: boolean;
}>();
const emit = defineEmits<{ layoutChange: [layout: DashboardLayoutItem[]] }>();
defineSlots<{
  item: (props: { widgetId: string; phone: boolean; flow: boolean; titled: boolean }) => unknown;
}>();
const titleId = useId();
const flowVariables = { "--dashboard-margin": `${DASHBOARD_MARGIN}px` } as CSSProperties;
</script>

<template>
  <section
    class="yayaw-dashboard-section"
    :aria-labelledby="props.title ? titleId : undefined"
    :data-dashboard-section="props.section.id"
    :data-section-type="props.section.type"
  >
    <h3 v-if="props.title" :id="titleId" class="yayaw-dashboard-section-title" data-section-title="">{{ props.title }}</h3>
    <DashboardGrid
      v-if="props.section.type === 'grid'"
      :layout="props.section.layout"
      :editing="props.editing"
      @layout-change="(layout) => emit('layoutChange', layout)"
    >
      <template #item="{ widgetId, phone }">
        <slot name="item" :widget-id="widgetId" :phone="phone" :flow="false" :titled="Boolean(props.title)" />
      </template>
    </DashboardGrid>
    <div v-else class="yayaw-dashboard-flow" data-dashboard-flow="" :style="flowVariables">
      <div v-for="widgetId in props.section.widgetIds" :key="widgetId" :data-dashboard-item="widgetId">
        <slot name="item" :widget-id="widgetId" :phone="false" :flow="true" :titled="Boolean(props.title)" />
      </div>
    </div>
  </section>
</template>
