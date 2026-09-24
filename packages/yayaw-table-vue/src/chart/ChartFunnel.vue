<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";
import {
  type ChartCategory,
  type ChartFunnelStage,
  type ChartLabelKey,
  type ChartModel,
  chartFunnelLayout,
} from "../chart-model";

const props = defineProps<{
  model: ChartModel;
  clickable: boolean;
  label: (key: ChartLabelKey, params?: Record<string, number | string>) => string;
}>();
const emit = defineEmits<{ group: [category: ChartCategory] }>();

const id = useId();
const container = ref<HTMLDivElement>();
const width = ref(0);
const active = ref<string>();
let observer: ResizeObserver | undefined;

// The funnel's width: measured, and followed as the container resizes.
const measure = (): void => {
  width.value = Math.round(container.value?.clientWidth ?? 0);
};
onMounted(() => {
  measure();
  if (typeof ResizeObserver === "undefined" || !container.value) return;
  observer = new ResizeObserver(measure);
  observer.observe(container.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** The same shapes and texts as the React edition, from the shared geometry. */
const layout = computed(() => chartFunnelLayout(props.model.stages ?? [], width.value));
const percentOf = (part: number, whole: number): string =>
  `${whole ? (part / whole) * 100 : 0}%`;
/** "Active: 3, 100% of first" and so on, for assistive technology. */
const summary = computed(() =>
  layout.value.shapes
    .map(({ stage }: { stage: ChartFunnelStage }) =>
      `${stage.label}: ${[stage.valueText, stage.shareText, stage.conversionText].filter(Boolean).join(", ")}`
    )
    .join("; ")
);
const buttons = computed(() =>
  props.clickable ? layout.value.shapes.filter((shape) => !shape.stage.category.other) : []
);
</script>

<template>
  <div ref="container" class="yayaw-chart-funnel" :data-chart-funnel="layout.orientation">
    <svg
      role="img"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-desc`"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      :width="layout.width"
      :height="layout.height"
    >
      <title :id="`${id}-title`">{{ props.model.title }}</title>
      <desc :id="`${id}-desc`">{{ summary }}</desc>
      <g v-for="shape in layout.shapes" :key="shape.stage.id" :data-funnel-stage="shape.stage.label">
        <polygon
          :points="shape.points"
          :fill="shape.stage.color"
          :class="{ 'yayaw-chart-funnel-dim': active && active !== shape.stage.id }"
        />
        <text class="yayaw-chart-funnel-name" :x="shape.name.x" :y="shape.name.y" :text-anchor="shape.name.anchor">{{ shape.name.text }}</text>
        <text class="yayaw-chart-funnel-value" :x="shape.value.x" :y="shape.value.y" :text-anchor="shape.value.anchor">{{ shape.value.text }}</text>
        <text class="yayaw-chart-funnel-rate" :x="shape.share.x" :y="shape.share.y" :text-anchor="shape.share.anchor">{{ shape.share.text }}</text>
        <text
          v-if="shape.conversion"
          class="yayaw-chart-funnel-rate"
          :x="shape.conversion.x"
          :y="shape.conversion.y"
          :text-anchor="shape.conversion.anchor"
        >{{ shape.conversion.text }}</text>
      </g>
    </svg>
    <button
      v-for="shape in buttons"
      :key="shape.stage.id"
      type="button"
      class="yayaw-chart-funnel-button"
      data-funnel-button
      :aria-label="props.label('showRecords', { group: shape.stage.label })"
      :style="{
        left: percentOf(shape.box.x, layout.width),
        top: percentOf(shape.box.y, layout.height),
        width: percentOf(shape.box.width, layout.width),
        height: percentOf(shape.box.height, layout.height),
      }"
      @click="emit('group', shape.stage.category)"
      @focus="active = shape.stage.id"
      @blur="active = undefined"
      @mouseenter="active = shape.stage.id"
      @mouseleave="active = undefined"
    />
  </div>
</template>
