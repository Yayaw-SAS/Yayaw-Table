<script setup lang="ts">
import {
  ChevronRight,
  ExternalLink,
  Eye,
  FolderInput,
  FolderPlus,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { type Component, computed } from "vue";
import TableCheckbox from "../components/controls/TableCheckbox.vue";
import type {
  FileTreeController,
  FileTreeMenuKey,
  FileTreeState,
} from "../filetree-controller";
import {
  FILETREE_UNFILED,
  type FileTreeColumn,
  type FileTreeHooks,
  type FileTreeLabelKey,
  type FileTreeNodeRow,
  fileTreeDropMark,
  fileTreeIcon,
  formatFileTreeValue,
  highlightFileTreeName,
  indentLevel,
  type ResolvedFileTreeSettings,
} from "../filetree-model";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import type { ColumnDefinition } from "../types";
import FileTreeIcon from "./FileTreeIcon.vue";
import FileTreeNameInput from "./FileTreeNameInput.vue";

const props = defineProps<{
  row: FileTreeNodeRow;
  state: FileTreeState;
  controller: FileTreeController;
  context: DisplayModeRenderContext;
  settings: ResolvedFileTreeSettings;
  columns: ColumnDefinition[];
  selectable: boolean;
  query: string;
  menuOpen: boolean;
  hasMedia: boolean;
  label: (key: FileTreeLabelKey, params?: Record<string, string | number>) => string;
}>();
const emit = defineEmits<{
  menu: [key: FileTreeMenuKey, id: string];
  menuOpen: [open: boolean];
}>();

const MENU_ICONS: Record<FileTreeMenuKey, Component> = {
  info: Info,
  preview: Eye,
  open: ExternalLink,
  rename: Pencil,
  move: FolderInput,
  "new-folder": FolderPlus,
  delete: Trash2,
};

const record = computed(() => props.controller.row(props.row.id));
const icon = computed(() =>
  props.row.id === FILETREE_UNFILED
    ? { kind: props.row.expanded ? ("folder-open" as const) : ("folder" as const) }
    : fileTreeIcon(record.value ?? {}, {
        folder: props.row.folder,
        expanded: props.row.expanded,
        nameColumn: props.settings.nameColumn,
        media: props.context.media,
        imageColumn: props.context.imageColumn,
        getIcon: (props.context.defaults as FileTreeHooks).getIcon,
      })
);
const focused = computed(
  () => (props.state.focusedId ?? props.state.rows.find((item) => item.type === "node")?.id) === props.row.id
);
const selected = computed(() => props.state.selection.has(props.row.id));
const menu = computed(() =>
  props.controller.menuItems(props.row.id, { preview: props.hasMedia })
);
const parts = computed(() =>
  highlightFileTreeName(props.row.name, props.state.matches.has(props.row.id) ? props.query : "")
);
const count = computed(() =>
  !props.state.searching && props.row.folder && props.row.childCount ? props.row.childCount : undefined
);
const numeric = (column: ColumnDefinition) =>
  column.id === props.settings.sizeColumn || column.type === "number";
const text = (column: ColumnDefinition): string =>
  props.row.id === FILETREE_UNFILED
    ? "--"
    : formatFileTreeValue(record.value?.[column.id], column as FileTreeColumn, {
        locale: props.context.locale,
        settings: props.settings,
        folder: props.row.folder,
        folderSize: props.controller.folderSize(props.row.id),
      });
let shift = false;
const rememberShift = (event: MouseEvent): void => {
  shift = event.shiftKey;
};
const onClick = (event: MouseEvent): void => {
  props.controller.click(props.row.id, event);
  if (props.state.phone) {
    props.controller.activate(props.row.id);
  }
};
const onDoubleClick = (): void => {
  if (!props.state.phone) {
    props.controller.activate(props.row.id);
  }
};
const onFocus = (event: FocusEvent): void => {
  if (event.target === event.currentTarget) {
    props.controller.setFocused(props.row.id);
  }
};
const toggleSelected = (): void => {
  props.controller.toggleSelected(props.row.id, shift);
  shift = false;
};
</script>

<template>
  <div
    class="yayaw-ft-row"
    role="row"
    :aria-expanded="props.row.folder && props.row.hasChildren ? props.row.expanded : undefined"
    :aria-label="props.row.name"
    :aria-level="props.row.level"
    :aria-posinset="props.row.posinset"
    :aria-selected="selected"
    :aria-setsize="props.row.setsize"
    :data-cut="props.state.cut.has(props.row.id) || undefined"
    :data-dragging="props.state.drag?.ids.includes(props.row.id) || undefined"
    :data-filetree-id="props.row.id"
    :data-folder="props.row.folder"
    :data-ft-drop="fileTreeDropMark(props.row.id, props.state.drag)"
    :data-match="props.state.matches.has(props.row.id) || undefined"
    :style="{ '--ft-level': indentLevel(props.row.level) }"
    :tabindex="focused ? 0 : -1"
    @click="onClick"
    @dblclick="onDoubleClick"
    @focus="onFocus"
  >
    <div
      v-if="props.selectable"
      class="yayaw-ft-cell yayaw-ft-check"
      role="gridcell"
      @click.capture="rememberShift"
    >
      <TableCheckbox
        v-if="props.row.id !== FILETREE_UNFILED"
        :label="`${props.label('selectRow')} ${props.row.name}`"
        :model-value="selected"
        tabindex="-1"
        @click.stop
        @update:model-value="toggleSelected"
      />
    </div>
    <div class="yayaw-ft-cell yayaw-ft-name" role="gridcell">
      <button
        v-if="props.row.folder && props.row.hasChildren && !props.state.phone"
        type="button"
        class="yayaw-ft-toggle"
        tabindex="-1"
        :data-expanded="props.row.expanded"
        :aria-label="props.label(props.row.expanded ? 'collapse' : 'expand')"
        @click.stop="props.controller.toggle(props.row.id)"
      >
        <ChevronRight aria-hidden="true" />
      </button>
      <span v-else class="yayaw-ft-spacer" />
      <FileTreeIcon :icon="icon" />
      <FileTreeNameInput
        v-if="props.state.renamingId === props.row.id"
        :initial="props.row.name"
        :label="props.label('rename')"
        :error="props.state.renameError"
        @cancel="props.controller.cancelRename()"
        @commit="(value) => props.controller.commitRename(value).catch(() => undefined)"
      />
      <span v-else class="yayaw-ft-label" :title="props.row.name"
        ><template v-for="(part, index) in parts" :key="index"
          ><mark v-if="part.match">{{ part.text }}</mark
          ><span v-else>{{ part.text }}</span></template
        ></span
      >
      <span v-if="count" class="yayaw-ft-count">{{ count }}</span>
    </div>
    <div
      v-for="column in props.columns"
      :key="column.id"
      class="yayaw-ft-cell"
      role="gridcell"
      data-optional="true"
      :data-align="numeric(column) ? 'end' : undefined"
      :data-muted="column.id === props.settings.updatedColumn || undefined"
    >
      {{ text(column) }}
    </div>
    <div class="yayaw-ft-cell yayaw-ft-menu" role="gridcell">
      <DropdownMenuRoot
        v-if="menu.length"
        :open="props.menuOpen"
        :modal="false"
        @update:open="emit('menuOpen', $event)"
      >
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="yayaw-ft-icon-button"
            tabindex="-1"
            :aria-label="props.label('actions')"
            @click.stop
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            class="yayaw-row-actions-menu"
            align="end"
            :side-offset="4"
            :collision-padding="8"
            :aria-label="props.label('actions')"
            @click.stop
          >
            <template v-for="item in menu" :key="item.key">
              <DropdownMenuSeparator v-if="item.danger" class="yayaw-row-actions-divider" />
              <DropdownMenuItem as-child @select="emit('menu', item.key, props.row.id)">
                <button
                  type="button"
                  class="yayaw-row-action-item"
                  :class="{ 'yayaw-row-action-danger': item.danger }"
                >
                  <component :is="MENU_ICONS[item.key]" :size="16" aria-hidden="true" />{{ item.label }}
                </button>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>
