<script setup lang="ts">
import { Download, Share2 } from "lucide-vue-next";
import type { ToolbarAction } from "../../types";
import TableTooltip from "./TableTooltip.vue";

defineProps<{
  items: Array<{ kind: "action"; key: string; action: ToolbarAction } | { kind: "export"; key: string }>;
  actionsAsIcons: boolean; compact: boolean; search: string; searchLabel: string; exportLabel: string; shareLabel: string;
  showSearch?: boolean; pendingAction?: string; isExporting: boolean;
  disabled: (action: ToolbarAction) => boolean;
  variant: (action: ToolbarAction) => string;
}>();
const emit = defineEmits<{ "update:search": [search: string]; action: [action: ToolbarAction]; export: []; share: [] }>();
</script>

<template>
  <div class="yayaw-data-actions" :data-compact="compact">
    <input v-if="showSearch !== false" :value="search" type="search" class="yayaw-input yayaw-search" :placeholder="searchLabel" :aria-label="searchLabel" @input="emit('update:search', ($event.target as HTMLInputElement).value)" />
    <template v-for="item in items" :key="item.key">
      <TableTooltip v-if="item.kind === 'action'" :label="actionsAsIcons ? (item.action.tooltip ?? item.action.label) : item.action.tooltip">
        <button type="button" class="yayaw-button" :class="[variant(item.action), { 'yayaw-icon-only': actionsAsIcons }]"
          :disabled="disabled(item.action)" :aria-label="item.action.label" @click="emit('action', item.action)">
          <span v-if="pendingAction === item.action.id || item.action.loading" class="yayaw-spinner" aria-hidden="true" />
          <component v-else-if="item.action.icon" :is="item.action.icon" :size="16" aria-hidden="true" />
          <span v-else-if="actionsAsIcons" aria-hidden="true">{{ item.action.label.slice(0, 1) }}</span>
          <span v-if="!actionsAsIcons">{{ item.action.label }}</span>
        </button>
      </TableTooltip>
      <TableTooltip v-else :label="actionsAsIcons ? exportLabel : undefined">
        <button type="button" class="yayaw-button yayaw-button-outline" :class="{ 'yayaw-icon-only': actionsAsIcons }" :aria-label="exportLabel" :disabled="isExporting" :aria-busy="isExporting" @click="emit('export')">
          <Download :size="16" aria-hidden="true" /><span v-if="!actionsAsIcons">{{ exportLabel }}</span>
        </button>
      </TableTooltip>
    </template>
    <TableTooltip :label="shareLabel"><button type="button" class="yayaw-button yayaw-button-outline" :class="{ 'yayaw-icon-only': actionsAsIcons }" :aria-label="shareLabel" @click="emit('share')">
      <Share2 :size="16" aria-hidden="true" /><span v-if="!actionsAsIcons">{{ shareLabel }}</span>
    </button></TableTooltip>
  </div>
</template>
