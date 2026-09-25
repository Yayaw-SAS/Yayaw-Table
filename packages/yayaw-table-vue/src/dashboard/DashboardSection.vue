<script setup lang="ts">
import { type CSSProperties, computed, useId, useSlots } from "vue";
import DashboardGrid from "./DashboardGrid.vue";
import { DASHBOARD_MARGIN, type DashboardLayoutItem } from "./dashboard-layout";
import type { DashboardSection } from "./dashboard-schema";

/**
 * A section: its title (in edit mode, its bar), then a grid of cards (its own
 * gridstack) or widgets stacked at full width and their natural height (a
 * flow).
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
  /** Edit mode: the section's bar (its title input and menu), shown instead of its heading. */
  bar?: () => unknown;
  /** Edit mode: what an empty section shows ("Add widget here"). */
  empty?: () => unknown;
}>();
const slots = useSlots();
const titleId = useId();
const flowVariables = { "--dashboard-margin": `${DASHBOARD_MARGIN}px` } as CSSProperties;
const hasBar = computed(() => props.editing && Boolean(slots.bar));
const showsEmpty = computed(
  () =>
    props.editing &&
    Boolean(slots.empty) &&
    (props.section.type === "grid" ? props.section.layout.length === 0 : props.section.widgetIds.length === 0)
);
</script>

<template>
  <section
    class="yayaw-dashboard-section"
    :aria-labelledby="props.title ? titleId : undefined"
    :data-dashboard-section="props.section.id"
    :data-section-type="props.section.type"
  >
    <h3
      v-if="props.title"
      :id="titleId"
      :class="['yayaw-dashboard-section-title', { 'yayaw-dashboard-sr-only': hasBar }]"
      data-section-title=""
    >{{ props.title }}</h3>
    <slot v-if="hasBar" name="bar" />
    <slot v-if="showsEmpty" name="empty" />
    <DashboardGrid
      v-else-if="props.section.type === 'grid'"
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
