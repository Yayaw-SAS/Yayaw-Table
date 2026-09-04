<script setup lang="ts">
import type { Column } from "@tanstack/vue-table";
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, ArrowUpDown, EyeOff, GripVertical, MoreHorizontal, PinOff } from "lucide-vue-next";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import type { TableRecord } from "../../types";

const props = defineProps<{ column: Column<TableRecord> }>();
const context = useTableContext();
const label = computed(() => context.config.columns.definitions.find(column => column.id === props.column.id)?.header ?? props.column.id);
const columnDndFeatureEnabled = computed(() => context.config.table.enableColumnDnd !== false);
const available = computed(() => !["select", "actions"].includes(props.column.id) && (props.column.getCanSort() || props.column.getCanHide() || props.column.getCanPin() || columnDndFeatureEnabled.value));
const translate = (key: string): string => String(context.translations.value[key]);
const toggleColumnDrag = (): void => {
  if (columnDndFeatureEnabled.value) {
    context.state.columnDragEnabled.value = !context.state.columnDragEnabled.value;
  }
};
</script>

<template>
  <DropdownMenuRoot v-if="available" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="yayaw-column-menu-trigger" :aria-label="`${translate('columnOptions')}: ${label}`" :title="translate('columnOptions')" @click.stop @pointerdown.stop>
        <MoreHorizontal :size="16" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="yayaw-column-menu" :aria-label="`${translate('columnOptions')}: ${label}`" align="start" :side-offset="4" @click.stop>
        <template v-if="column.getCanSort()">
          <DropdownMenuItem class="yayaw-column-menu-item" @select="column.toggleSorting(false)"><ArrowUp :size="16" aria-hidden="true" />{{ translate('ascending') }}</DropdownMenuItem>
          <DropdownMenuItem class="yayaw-column-menu-item" @select="column.toggleSorting(true)"><ArrowDown :size="16" aria-hidden="true" />{{ translate('descending') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="column.getIsSorted()" class="yayaw-column-menu-item" @select="column.clearSorting()"><ArrowUpDown :size="16" aria-hidden="true" />{{ translate('clearSort') }}</DropdownMenuItem>
        </template>
        <DropdownMenuSeparator v-if="column.getCanSort() && (column.getCanPin() || column.getCanHide())" class="yayaw-column-menu-divider" />
        <template v-if="column.getCanPin()">
          <DropdownMenuItem class="yayaw-column-menu-item" :disabled="column.getIsPinned() === 'left'" @select="column.pin('left')"><ArrowLeftToLine :size="16" aria-hidden="true" />{{ translate('pinLeft') }}</DropdownMenuItem>
          <DropdownMenuItem class="yayaw-column-menu-item" :disabled="column.getIsPinned() === 'right'" @select="column.pin('right')"><ArrowRightToLine :size="16" aria-hidden="true" />{{ translate('pinRight') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="column.getIsPinned()" class="yayaw-column-menu-item" @select="column.pin(false)"><PinOff :size="16" aria-hidden="true" />{{ translate('unpin') }}</DropdownMenuItem>
        </template>
        <DropdownMenuSeparator v-if="column.getCanPin() && column.getCanHide()" class="yayaw-column-menu-divider" />
        <DropdownMenuItem v-if="column.getCanHide()" class="yayaw-column-menu-item" @select="column.toggleVisibility(false)"><EyeOff :size="16" aria-hidden="true" />{{ translate('hideColumn') }}</DropdownMenuItem>
        <DropdownMenuSeparator v-if="columnDndFeatureEnabled && (column.getCanSort() || column.getCanPin() || column.getCanHide())" class="yayaw-column-menu-divider" />
        <DropdownMenuItem v-if="columnDndFeatureEnabled" class="yayaw-column-menu-item" @select="toggleColumnDrag"><GripVertical :size="16" aria-hidden="true" />{{ translate('columns.reorder') }}<span v-if="context.state.columnDragEnabled.value" aria-hidden="true">✓</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
