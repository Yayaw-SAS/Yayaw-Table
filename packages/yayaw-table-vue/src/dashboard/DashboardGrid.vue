<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from "vue";
import type { DashboardGridController } from "./dashboard-grid-engine";
import {
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  type DashboardLayoutItem,
  dashboardColumnsForWidth,
  layoutRows,
  stackLayout,
} from "./dashboard-layout";
import "./dashboard-grid.css";

/** Four columns with gridstack on desktop; one stacked column on phones. */
const props = defineProps<{ layout: DashboardLayoutItem[]; editing: boolean }>();
const emit = defineEmits<{ layoutChange: [layout: DashboardLayoutItem[]] }>();
defineSlots<{ item: (props: { widgetId: string; phone: boolean }) => unknown }>();

const container = ref<HTMLElement>();
const gridElement = ref<HTMLElement>();
const width = ref(0);
const ready = ref(false);
let observer: ResizeObserver | undefined;
let controller: DashboardGridController | undefined;
let mounting = 0;

const phone = computed(() => dashboardColumnsForWidth(width.value) === 1);
const ordered = computed(() => [...props.layout].sort((a, b) => a.y - b.y || a.x - b.x));
const stacked = computed(() => stackLayout(props.layout));
const gridVariables = computed(() => ({
  "--dashboard-rows": layoutRows(props.layout),
  "--dashboard-row-height": `${DASHBOARD_ROW_HEIGHT}px`,
  "--dashboard-margin": `${DASHBOARD_MARGIN}px`,
}) as CSSProperties);
const itemVariables = (item: DashboardLayoutItem) => ({
  "--dashboard-x": item.x,
  "--dashboard-y": item.y,
  "--dashboard-w": item.w,
  "--dashboard-h": item.h,
}) as CSSProperties;

const stop = () => {
  mounting += 1;
  controller?.destroy();
  controller = undefined;
  ready.value = false;
};

// gridstack loads with the first desktop grid, not with the page.
const start = async (element: HTMLElement) => {
  const attempt = ++mounting;
  try {
    const { mountDashboardGrid } = await import("./dashboard-grid-engine");
    if (attempt !== mounting || gridElement.value !== element) return;
    controller = mountDashboardGrid(element, {
      editing: props.editing,
      onChange: (next) => emit("layoutChange", next),
    });
    controller.sync(props.layout, props.editing);
    ready.value = true;
  } catch {
    // Without gridstack, the CSS layout and the keyboard menu still work.
  }
};

watch(gridElement, (element) => {
  stop();
  if (element) void start(element);
});
// After each change: new widgets join gridstack, moved ones take their place.
watch(
  () => [props.layout, props.editing] as const,
  async () => {
    await nextTick();
    controller?.sync(props.layout, props.editing);
  },
  { deep: true, flush: "post" }
);

onMounted(() => {
  const element = container.value;
  if (!element) return;
  width.value = element.getBoundingClientRect().width;
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = entry.contentRect.width;
  });
  observer.observe(element);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  stop();
});
</script>

<template>
  <div ref="container" :data-dashboard-layout="phone ? 'stack' : 'grid'" :style="gridVariables">
    <div v-if="phone" class="yayaw-dashboard-stack">
      <div v-for="item in stacked" :key="item.widgetId" :data-dashboard-item="item.widgetId"
        :data-layout="`${item.x},${item.y},${item.w},${item.h}`" :style="itemVariables(item)">
        <slot name="item" :widget-id="item.widgetId" :phone="true" />
      </div>
    </div>
    <div
      v-else
      ref="gridElement"
      class="grid-stack yayaw-dashboard-grid"
      :data-editing="editing ? '' : undefined"
      :data-grid-ready="ready ? '' : undefined"
    >
      <div
        v-for="item in ordered"
        :key="item.widgetId"
        class="grid-stack-item"
        :data-dashboard-item="item.widgetId"
        :data-layout="`${item.x},${item.y},${item.w},${item.h}`"
        :gs-id="item.widgetId"
        :gs-x="item.x"
        :gs-y="item.y"
        :gs-w="item.w"
        :gs-h="item.h"
        :style="itemVariables(item)"
      >
        <div class="grid-stack-item-content">
          <slot name="item" :widget-id="item.widgetId" :phone="false" />
        </div>
      </div>
    </div>
  </div>
</template>
