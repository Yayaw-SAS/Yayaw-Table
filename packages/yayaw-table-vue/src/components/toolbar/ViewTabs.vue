<script setup lang="ts">
import { Ellipsis, Plus } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";
import type { TableDisplayMode } from "../../types";
import { splitViewTabs } from "../../view-tabs";
import { displayModeIcons } from "./display-mode-icons";
import TableTooltip from "./TableTooltip.vue";

export interface ViewTabItem {
  /** `null` for the table's default view. */
  id: string | null;
  name: string;
  displayMode: TableDisplayMode;
}

const props = defineProps<{
  activeId: string | null;
  canCreate: boolean;
  defaultTab: ViewTabItem;
  dirty: boolean;
  disabled: boolean;
  /** `more` names the "…" button of the views past `maxVisible`. */
  labels: { tabs: string; more: string; newView: string; modified: string };
  maxVisible: number;
  views: ViewTabItem[];
}>();
const emit = defineEmits<{ select: [id: string | null]; create: [] }>();
const split = computed(() =>
  splitViewTabs(
    props.views.map((view) => ({ ...view, id: view.id ?? "" })),
    props.activeId,
    props.maxVisible
  )
);
const tabs = computed(() => [props.defaultTab, ...split.value.visible]);
</script>

<template>
  <div class="yayaw-view-tabs" data-view-tabs>
    <div class="yayaw-view-tablist" role="tablist" :aria-label="labels.tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id ?? ''"
        type="button"
        role="tab"
        class="yayaw-button yayaw-view-tab"
        :class="(tab.id || null) === activeId ? 'yayaw-button-secondary' : 'yayaw-button-ghost'"
        :aria-selected="(tab.id || null) === activeId"
        :data-view-tab="tab.id ?? ''"
        :disabled="disabled"
        @click="emit('select', tab.id || null)"
      >
        <component :is="displayModeIcons[tab.displayMode]" :size="16" aria-hidden="true" />
        <span class="yayaw-view-name">{{ tab.name }}</span>
        <output v-if="(tab.id || null) === activeId && dirty" class="yayaw-view-dirty" :aria-label="labels.modified" />
      </button>
    </div>
    <!-- An icon: the chevron next to it opens the view menu. -->
    <DropdownMenuRoot v-if="split.overflow.length" :modal="false">
      <DropdownMenuTrigger as-child>
        <TableTooltip :label="labels.more">
          <button type="button" class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-view-more" :aria-label="labels.more" :disabled="disabled">
            <Ellipsis :size="16" aria-hidden="true" />
          </button>
        </TableTooltip>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="yayaw-column-menu" align="start" :side-offset="4">
          <DropdownMenuItem
            v-for="view in split.overflow"
            :key="view.id"
            class="yayaw-column-menu-item"
            @select="emit('select', view.id)"
          >
            <component :is="displayModeIcons[view.displayMode]" :size="16" aria-hidden="true" />
            <span class="yayaw-view-name">{{ view.name }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <button
      v-if="canCreate"
      type="button"
      class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-view-new"
      :aria-label="labels.newView"
      :disabled="disabled"
      @click="emit('create')"
    >
      <Plus :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
