<script setup lang="ts">
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, GripVertical, MoreHorizontal,
  MoveDiagonal2, MoveHorizontal, MoveVertical, Shrink, Trash2,
} from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger,
} from "reka-ui";
import { computed, useId } from "vue";
import {
  canMoveLayoutItem,
  canResizeLayoutItem,
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardLayoutItem,
  type DashboardOverflow,
  type DashboardResize,
  type DashboardWidget,
  widgetOverflow,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-types";

/** A widget's card: title, "Open full view", the edit menu and its content. */
const props = defineProps<{
  widget: DashboardWidget;
  title: string;
  editing: boolean;
  phone: boolean;
  layout: DashboardLayoutItem[];
  label: DashboardLabel;
  openable: boolean;
}>();
const emit = defineEmits<{
  move: [direction: DashboardDirection];
  resize: [change: DashboardResize];
  remove: [];
  open: [];
}>();
const titleId = useId();
const overflow = computed<DashboardOverflow>(() =>
  props.widget.type === "view" ? widgetOverflow(props.widget) : "fit"
);

const moves: { direction: DashboardDirection; key: DashboardLabelKey; icon: unknown }[] = [
  { direction: "left", key: "moveLeft", icon: ArrowLeft },
  { direction: "right", key: "moveRight", icon: ArrowRight },
  { direction: "up", key: "moveUp", icon: ArrowUp },
  { direction: "down", key: "moveDown", icon: ArrowDown },
];
const resizes: { change: DashboardResize; key: DashboardLabelKey; icon: unknown }[] = [
  { change: "wider", key: "wider", icon: MoveHorizontal },
  { change: "narrower", key: "narrower", icon: Shrink },
  { change: "taller", key: "taller", icon: MoveVertical },
  { change: "shorter", key: "shorter", icon: MoveDiagonal2 },
];
</script>

<template>
  <section
    class="yayaw-dashboard-widget"
    :aria-labelledby="titleId"
    :data-dashboard-widget="props.widget.id"
    :data-widget-type="props.widget.type"
  >
    <header class="yayaw-dashboard-widget-header" data-widget-header="">
      <span
        v-if="props.editing && !props.phone"
        class="yayaw-dashboard-handle"
        aria-hidden="true"
        data-dashboard-drag-handle=""
        :title="props.label('dragHandle', { title: props.title })"
      >
        <GripVertical :size="16" />
      </span>
      <h3 :id="titleId" class="yayaw-dashboard-widget-title" data-widget-title="">{{ props.title }}</h3>
      <button
        v-if="props.openable"
        type="button"
        class="yayaw-dashboard-icon-button"
        :aria-label="props.label('openFullView')"
        :title="props.label('openFullView')"
        @click="emit('open')"
      >
        <ExternalLink :size="16" aria-hidden="true" />
      </button>
      <DropdownMenuRoot v-if="props.editing" :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="yayaw-dashboard-icon-button" :aria-label="props.label('widgetMenu', { title: props.title })">
            <MoreHorizontal :size="16" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-row-actions-menu yayaw-dashboard-menu" align="end" :side-offset="4" :collision-padding="8">
            <DropdownMenuItem
              v-for="item in moves"
              :key="item.direction"
              as-child
              :disabled="!canMoveLayoutItem(props.layout, props.widget.id, item.direction)"
              @select="emit('move', item.direction)"
            >
              <button type="button" class="yayaw-row-action-item" :disabled="!canMoveLayoutItem(props.layout, props.widget.id, item.direction)">
                <component :is="item.icon" :size="16" aria-hidden="true" />{{ props.label(item.key) }}
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator class="yayaw-row-actions-divider" />
            <DropdownMenuItem
              v-for="item in resizes"
              :key="item.change"
              as-child
              :disabled="!canResizeLayoutItem(props.layout, props.widget.id, item.change)"
              @select="emit('resize', item.change)"
            >
              <button type="button" class="yayaw-row-action-item" :disabled="!canResizeLayoutItem(props.layout, props.widget.id, item.change)">
                <component :is="item.icon" :size="16" aria-hidden="true" />{{ props.label(item.key) }}
              </button>
            </DropdownMenuItem>
            <DropdownMenuSeparator class="yayaw-row-actions-divider" />
            <DropdownMenuItem as-child @select="emit('remove')">
              <button type="button" class="yayaw-row-action-item yayaw-row-action-danger">
                <Trash2 :size="16" aria-hidden="true" />{{ props.label("remove") }}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </header>
    <div class="yayaw-dashboard-widget-body" data-widget-body="" :data-overflow="overflow">
      <slot />
    </div>
  </section>
</template>
