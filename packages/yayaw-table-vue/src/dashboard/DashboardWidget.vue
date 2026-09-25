<script setup lang="ts">
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, ExternalLink, FolderInput, GripVertical, MoreHorizontal,
  MoveDiagonal2, MoveHorizontal, MoveVertical, Shrink, Trash2,
} from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "reka-ui";
import { computed, useId } from "vue";
import {
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardOverflow,
  type DashboardResize,
  type DashboardWidget,
  widgetOverflow,
} from "./dashboard-model";
import type {
  DashboardLabel,
  DashboardWidgetMenuAction,
  DashboardWidgetMoveTarget,
} from "./dashboard-types";

/**
 * A widget's card: title, "Open full view", the edit menu and its content.
 * Full-page tables (`frame: "page"`) have no card: an edit bar in edit mode,
 * and a heading when the widget has a title of its own (`showHeading`).
 */
const props = withDefaults(
  defineProps<{
    widget: DashboardWidget;
    title: string;
    editing: boolean;
    /** Desktop grid widgets show a drag handle in edit mode. */
    draggable: boolean;
    /** Grid widgets resize from the menu; flow widgets keep their natural size. */
    resizable: boolean;
    /** 4 under a section title, else 3 (under the dashboard's name). */
    headingLevel?: 3 | 4;
    /** `card` (default), or `page` for full-page tables. */
    frame?: "card" | "page";
    /** Page frames: show the title as a heading. */
    showHeading?: boolean;
    label: DashboardLabel;
    canMove: (direction: DashboardDirection) => boolean;
    canResize: (change: DashboardResize) => boolean;
    openable: boolean;
    /** The editor's entries at the top of the menu (edit, edit view, copies…). */
    menuActions?: readonly DashboardWidgetMenuAction[];
    /** The other sections that take the widget ("Move to section"). */
    moveTargets?: readonly DashboardWidgetMoveTarget[];
  }>(),
  { headingLevel: 3, frame: "card", showHeading: false, menuActions: () => [], moveTargets: () => [] }
);
const emit = defineEmits<{
  move: [direction: DashboardDirection];
  resize: [change: DashboardResize];
  remove: [];
  open: [];
  moveToSection: [sectionId: string];
}>();
const titleId = useId();
const overflow = computed<DashboardOverflow>(() =>
  props.widget.type === "view" ? widgetOverflow(props.widget) : "fit"
);
const resizable = computed(() => props.resizable && props.frame !== "page");

const moves: { direction: DashboardDirection; key: DashboardLabelKey; icon: unknown }[] = [
  { direction: "left", key: "moveLeft", icon: ArrowLeft },
  { direction: "right", key: "moveRight", icon: ArrowRight },
  { direction: "up", key: "moveUp", icon: ArrowUp },
  { direction: "down", key: "moveDown", icon: ArrowDown },
];
// Flow widgets (and full-page tables) move up and down only.
const shownMoves = computed(() =>
  resizable.value ? moves : moves.filter((item) => item.direction === "up" || item.direction === "down")
);
const resizes: { change: DashboardResize; key: DashboardLabelKey; icon: unknown }[] = [
  { change: "wider", key: "wider", icon: MoveHorizontal },
  { change: "narrower", key: "narrower", icon: Shrink },
  { change: "taller", key: "taller", icon: MoveVertical },
  { change: "shorter", key: "shorter", icon: MoveDiagonal2 },
];
</script>

<template>
  <section
    :class="props.frame === 'page' ? 'yayaw-dashboard-page-widget' : 'yayaw-dashboard-widget'"
    :aria-label="props.frame === 'page' && !props.showHeading ? props.title : undefined"
    :aria-labelledby="props.frame !== 'page' || props.showHeading ? titleId : undefined"
    :data-dashboard-widget="props.widget.id"
    :data-widget-frame="props.frame === 'page' ? 'page' : undefined"
    :data-widget-type="props.widget.type"
  >
    <header
      v-if="props.frame !== 'page' || props.editing"
      :class="props.frame === 'page' ? 'yayaw-dashboard-edit-bar' : 'yayaw-dashboard-widget-header'"
      :data-widget-header="props.frame === 'page' ? undefined : ''"
      :data-widget-edit-bar="props.frame === 'page' ? '' : undefined"
    >
      <template v-if="props.frame === 'page'">
        <span class="yayaw-dashboard-edit-bar-title" data-widget-title="">{{ props.title }}</span>
        <span class="yayaw-dashboard-edit-bar-type">{{ props.label(props.widget.type === "table" ? "typeTable" : "typeBlock") }}</span>
      </template>
      <template v-else>
        <span
          v-if="props.editing && props.draggable"
          class="yayaw-dashboard-handle"
          aria-hidden="true"
          data-dashboard-drag-handle=""
          :title="props.label('dragHandle', { title: props.title })"
        >
          <GripVertical :size="16" />
        </span>
        <component
          :is="props.headingLevel === 4 ? 'h4' : 'h3'"
          :id="titleId"
          class="yayaw-dashboard-widget-title"
          data-widget-title=""
        >{{ props.title }}</component>
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
      </template>
      <DropdownMenuRoot v-if="props.editing" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="yayaw-dashboard-icon-button"
            :class="{ 'yayaw-dashboard-edit-bar-menu': props.frame === 'page' }"
            :aria-label="props.label('widgetMenu', { title: props.title })"
          >
            <MoreHorizontal :size="16" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-row-actions-menu yayaw-dashboard-menu" align="end" :side-offset="4" :collision-padding="8">
            <template v-if="props.menuActions.length">
              <DropdownMenuItem
                v-for="action in props.menuActions"
                :key="action.id"
                as-child
                @select="action.onSelect()"
              >
                <button type="button" class="yayaw-row-action-item" :data-widget-action="action.id">
                  <component :is="action.icon" v-if="action.icon" :size="16" aria-hidden="true" />{{ action.label }}
                </button>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="yayaw-row-actions-divider" />
            </template>
            <DropdownMenuItem
              v-for="item in shownMoves"
              :key="item.direction"
              as-child
              :disabled="!props.canMove(item.direction)"
              @select="emit('move', item.direction)"
            >
              <button type="button" class="yayaw-row-action-item" :disabled="!props.canMove(item.direction)">
                <component :is="item.icon" :size="16" aria-hidden="true" />{{ props.label(item.key) }}
              </button>
            </DropdownMenuItem>
            <DropdownMenuSub v-if="props.moveTargets.length">
              <DropdownMenuSubTrigger as-child>
                <button type="button" class="yayaw-row-action-item" data-widget-move-to="">
                  <FolderInput :size="16" aria-hidden="true" />{{ props.label("moveToSection") }}
                  <ChevronRight class="yayaw-dashboard-submenu-chevron" :size="16" aria-hidden="true" />
                </button>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent class="yayaw-row-actions-menu yayaw-dashboard-menu" :side-offset="4" :collision-padding="8">
                  <DropdownMenuItem
                    v-for="target in props.moveTargets"
                    :key="target.id"
                    as-child
                    @select="emit('moveToSection', target.id)"
                  >
                    <button type="button" class="yayaw-row-action-item" :data-move-target="target.id">{{ target.name }}</button>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator class="yayaw-row-actions-divider" />
            <template v-if="resizable">
              <DropdownMenuItem
                v-for="item in resizes"
                :key="item.change"
                as-child
                :disabled="!props.canResize(item.change)"
                @select="emit('resize', item.change)"
              >
                <button type="button" class="yayaw-row-action-item" :disabled="!props.canResize(item.change)">
                  <component :is="item.icon" :size="16" aria-hidden="true" />{{ props.label(item.key) }}
                </button>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="yayaw-row-actions-divider" />
            </template>
            <DropdownMenuItem as-child @select="emit('remove')">
              <button type="button" class="yayaw-row-action-item yayaw-row-action-danger">
                <Trash2 :size="16" aria-hidden="true" />{{ props.label("remove") }}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </header>
    <component
      :is="props.headingLevel === 4 ? 'h4' : 'h3'"
      v-if="props.frame === 'page' && props.showHeading"
      :id="titleId"
      class="yayaw-dashboard-page-heading"
      data-widget-heading=""
    >{{ props.title }}</component>
    <div
      :class="props.frame === 'page' ? 'yayaw-dashboard-page-body' : 'yayaw-dashboard-widget-body'"
      data-widget-body=""
      :data-overflow="props.frame === 'page' ? undefined : overflow"
    >
      <slot />
    </div>
  </section>
</template>
