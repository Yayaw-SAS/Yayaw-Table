<script setup lang="ts">
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger,
} from "reka-ui";
import type { DashboardSectionMove } from "./dashboard-editor-model";
import type { DashboardSection } from "./dashboard-schema";
import type { DashboardLabel } from "./dashboard-types";

/** A section in edit mode: its title and its menu (move, add a widget, remove). */
const props = defineProps<{
  section: DashboardSection;
  /** The section's name in menus: its title, else "Section 2". */
  name: string;
  /** The title in the language edited (no other language's version). */
  titleInput: string;
  label: DashboardLabel;
  canMove: (direction: DashboardSectionMove) => boolean;
}>();
const emit = defineEmits<{
  rename: [title: string];
  move: [direction: DashboardSectionMove];
  addWidget: [];
  remove: [];
}>();
</script>

<template>
  <div class="yayaw-dashboard-section-bar" :data-section-bar="props.section.id">
    <input
      class="yayaw-input yayaw-dashboard-section-input"
      :aria-label="props.label('sectionTitle')"
      :placeholder="props.name"
      :value="props.titleInput"
      maxlength="120"
      @input="emit('rename', ($event.target as HTMLInputElement).value)"
    >
    <span class="yayaw-dashboard-edit-bar-type">{{ props.label(props.section.type === "grid" ? "sectionGrid" : "sectionFlow") }}</span>
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="yayaw-dashboard-icon-button yayaw-dashboard-edit-bar-menu"
          :aria-label="props.label('sectionMenu', { title: props.name })"
        >
          <MoreHorizontal :size="16" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="yayaw-row-actions-menu yayaw-dashboard-menu" align="end" :side-offset="4" :collision-padding="8">
          <DropdownMenuItem as-child :disabled="!props.canMove('up')" @select="emit('move', 'up')">
            <button type="button" class="yayaw-row-action-item" :disabled="!props.canMove('up')">
              <ArrowUp :size="16" aria-hidden="true" />{{ props.label("moveUp") }}
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem as-child :disabled="!props.canMove('down')" @select="emit('move', 'down')">
            <button type="button" class="yayaw-row-action-item" :disabled="!props.canMove('down')">
              <ArrowDown :size="16" aria-hidden="true" />{{ props.label("moveDown") }}
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem as-child @select="emit('addWidget')">
            <button type="button" class="yayaw-row-action-item">
              <Plus :size="16" aria-hidden="true" />{{ props.label("addWidgetHere") }}
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
  </div>
</template>
