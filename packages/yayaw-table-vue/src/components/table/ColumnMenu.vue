<script setup lang="ts">
import TableTooltip from "../toolbar/TableTooltip.vue";
import type { Column } from "../../tanstack";
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, ArrowUpDown, EyeOff, Funnel, GripVertical, MoreHorizontal, PinOff, Tags } from "lucide-vue-next";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from "reka-ui";
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import type { TableRecord } from "../../types";
import ManageTagsDialog from "../tags/ManageTagsDialog.vue";

const props = defineProps<{ column: Column<TableRecord> }>();
const context = useTableContext();
// Keep the popper anchored to the button when composed with its tooltip.
const trigger = ref<HTMLButtonElement>();
const label = computed(() => context.config.columns.definitions.find(column => column.id === props.column.id)?.header ?? props.column.id);
const columnDndFeatureEnabled = computed(() => context.config.table.enableColumnDnd !== false);
// "Manage tags" for tags columns the host lets users edit (`actions.tags`).
const canManageTags = computed(() => context.tags?.canManage(props.column.id) === true);
const managingTags = ref(false);
const available = computed(() => !["select", "actions"].includes(props.column.id) && (props.column.getCanSort() || props.column.getCanFilter() || props.column.getCanHide() || props.column.getCanPin() || columnDndFeatureEnabled.value || canManageTags.value));
const translate = (key: string): string => String(context.translations.value[key]);
const toggleColumnDrag = (): void => {
  if (columnDndFeatureEnabled.value) {
    context.state.columnDragEnabled.value = !context.state.columnDragEnabled.value;
  }
};
let filterFocusRequested = false;
const openColumnFilter = (): void => {
  filterFocusRequested = true;
  context.optionsRequest.value = { columnId: props.column.id, view: "filters" };
};
const restoreMenuFocus = (event: Event): void => {
  // The Options panel owns focus after navigating to a column filter.
  if (filterFocusRequested) event.preventDefault();
  filterFocusRequested = false;
};
</script>

<template>
  <DropdownMenuRoot v-if="available" :modal="false">
    <TableTooltip :label="translate('columnOptions')">
      <DropdownMenuTrigger as-child>
        <button
          ref="trigger"
          type="button"
          class="yayaw-column-menu-trigger"
          :aria-label="`${translate('columnOptions')}: ${label}`"
          @click.stop
          @pointerdown.stop
        >
          <MoreHorizontal :size="16" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
    </TableTooltip>
    <DropdownMenuPortal>
      <DropdownMenuContent :reference="trigger" class="yayaw-column-menu" :aria-label="`${translate('columnOptions')}: ${label}`" align="start" :side-offset="4" @click.stop @close-auto-focus="restoreMenuFocus">
        <template v-if="column.getCanSort()">
          <DropdownMenuItem class="yayaw-column-menu-item" @select="column.toggleSorting(false)"><ArrowUp :size="16" aria-hidden="true" />{{ translate('ascending') }}</DropdownMenuItem>
          <DropdownMenuItem class="yayaw-column-menu-item" @select="column.toggleSorting(true)"><ArrowDown :size="16" aria-hidden="true" />{{ translate('descending') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="column.getIsSorted()" class="yayaw-column-menu-item" @select="column.clearSorting()"><ArrowUpDown :size="16" aria-hidden="true" />{{ translate('clearSort') }}</DropdownMenuItem>
        </template>
        <DropdownMenuItem v-if="column.getCanFilter()" class="yayaw-column-menu-item" @select="openColumnFilter"><Funnel :size="16" aria-hidden="true" />{{ translate('filters.column') }}</DropdownMenuItem>
        <DropdownMenuItem v-if="canManageTags && context.tags" class="yayaw-column-menu-item" @select="managingTags = true"><Tags :size="16" aria-hidden="true" />{{ context.tags.labels.value.manageTags }}</DropdownMenuItem>
        <DropdownMenuSeparator v-if="(column.getCanSort() || column.getCanFilter()) && (column.getCanPin() || column.getCanHide())" class="yayaw-column-menu-divider" />
        <template v-if="column.getCanPin()">
          <DropdownMenuItem class="yayaw-column-menu-item" :disabled="column.getIsPinned() === 'start'" @select="column.pin('start')"><ArrowLeftToLine :size="16" aria-hidden="true" />{{ translate('pinLeft') }}</DropdownMenuItem>
          <DropdownMenuItem class="yayaw-column-menu-item" :disabled="column.getIsPinned() === 'end'" @select="column.pin('end')"><ArrowRightToLine :size="16" aria-hidden="true" />{{ translate('pinRight') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="column.getIsPinned()" class="yayaw-column-menu-item" @select="column.pin(false)"><PinOff :size="16" aria-hidden="true" />{{ translate('unpin') }}</DropdownMenuItem>
        </template>
        <DropdownMenuSeparator v-if="column.getCanPin() && column.getCanHide()" class="yayaw-column-menu-divider" />
        <DropdownMenuItem v-if="column.getCanHide()" class="yayaw-column-menu-item" @select="column.toggleVisibility(false)"><EyeOff :size="16" aria-hidden="true" />{{ translate('hideColumn') }}</DropdownMenuItem>
        <DropdownMenuSeparator v-if="columnDndFeatureEnabled && (column.getCanSort() || column.getCanPin() || column.getCanHide())" class="yayaw-column-menu-divider" />
        <DropdownMenuItem v-if="columnDndFeatureEnabled" class="yayaw-column-menu-item" @select="toggleColumnDrag"><GripVertical :size="16" aria-hidden="true" />{{ translate('columns.reorder') }}<span v-if="context.state.columnDragEnabled.value" aria-hidden="true">✓</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <ManageTagsDialog v-if="canManageTags" v-model:open="managingTags" :column-id="column.id" />
</template>
