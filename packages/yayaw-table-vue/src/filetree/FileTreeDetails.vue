<script setup lang="ts">
import {
  ExternalLink,
  Eye,
  FolderInput,
  FolderPlus,
  Info,
  Pencil,
  Trash2,
  X,
} from "lucide-vue-next";
import { type Component, computed, onBeforeUnmount, ref, watch } from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import type {
  FileTreeController,
  FileTreeMenuKey,
  FileTreeState,
} from "../filetree-controller";
import {
  detailsWidthAfterKey,
  FILETREE_DETAILS_MAX,
  FILETREE_DETAILS_MIN,
  startDetailsResize,
} from "../filetree-dom";
import {
  FILETREE_UNFILED,
  type FileTreeColumn,
  type FileTreeHooks,
  type FileTreeLabelKey,
  type FileTreeNodeRow,
  fileTreeIcon,
  formatFileTreeValue,
  type ResolvedFileTreeSettings,
} from "../filetree-model";
import { resolveGalleryMedia } from "../media-contract";
import { attachMediaThumbnail } from "../media-viewer";
import type { ColumnDefinition, TableRecord } from "../types";
import FileTreeIcon from "./FileTreeIcon.vue";

const props = defineProps<{
  state: FileTreeState;
  controller: FileTreeController;
  context: DisplayModeRenderContext;
  settings: ResolvedFileTreeSettings;
  columns: ColumnDefinition[];
  width: number;
  label: (key: FileTreeLabelKey, params?: Record<string, string | number>) => string;
}>();
const emit = defineEmits<{
  close: [];
  width: [width: number];
  menu: [key: FileTreeMenuKey, id: string];
  open: [row: TableRecord];
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

const hooks = computed(() => props.context.defaults as FileTreeHooks);
const row = computed(() =>
  props.state.rows.find(
    (item): item is FileTreeNodeRow => item.type === "node" && item.id === props.state.focusedId
  )
);
const record = computed(() =>
  row.value && row.value.id !== FILETREE_UNFILED ? props.controller.row(row.value.id) : undefined
);
const source = computed(() =>
  record.value && props.context.media?.enabled
    ? resolveGalleryMedia(record.value, props.context.media, props.context.imageColumn)
    : undefined
);
const custom = computed(() =>
  record.value ? hooks.value.renderDetails?.(record.value) : undefined
);
const icon = computed(() =>
  fileTreeIcon(record.value ?? {}, {
    folder: Boolean(row.value?.folder),
    nameColumn: props.settings.nameColumn,
    media: props.context.media,
    imageColumn: props.context.imageColumn,
    getIcon: hooks.value.getIcon,
  })
);
const menu = computed(() =>
  row.value
    ? props.controller
        .menuItems(row.value.id, { preview: Boolean(source.value) })
        .filter((item) => item.key !== "info")
    : []
);
const detailColumns = computed(() => [
  ...props.columns,
  ...props.settings.detailFields
    .filter((field) => !props.settings.columns.includes(field))
    .flatMap((field) => props.context.columns.filter((column) => column.id === field)),
]);
const format = (column: ColumnDefinition): string =>
  formatFileTreeValue(record.value?.[column.id], column as FileTreeColumn, {
    locale: props.context.locale,
    settings: props.settings,
    folder: row.value?.folder,
    folderSize: row.value ? props.controller.folderSize(row.value.id) : undefined,
  });
const preview = ref<HTMLElement>();
let detach: (() => void) | undefined;
watch(
  [preview, source, record],
  () => {
    detach?.();
    detach = undefined;
    const current = record.value;
    if (preview.value && source.value && current && row.value) {
      detach = attachMediaThumbnail(preview.value, source.value, row.value.name, {
        fit: "cover",
        hoverPreview: true,
        previewLabel: props.label("preview"),
        onOpen: () => emit("open", current),
      });
    }
  },
  { flush: "post" }
);
onBeforeUnmount(() => detach?.());
const resizeKey = (event: KeyboardEvent): void => {
  const next = detailsWidthAfterKey(props.width, event.key);
  if (next !== undefined) {
    event.preventDefault();
    emit("width", next);
  }
};
</script>

<template>
  <aside class="yayaw-ft-details" :aria-label="props.label('details')">
    <div
      class="yayaw-ft-resize"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="props.label('resizeDetails')"
      :aria-valuemin="FILETREE_DETAILS_MIN"
      :aria-valuemax="FILETREE_DETAILS_MAX"
      :aria-valuenow="props.width"
      @keydown="resizeKey"
      @pointerdown="startDetailsResize($event, props.width, (width) => emit('width', width))"
    />
    <header>
      <h3>{{ row && record ? row.name : props.label("details") }}</h3>
      <button
        type="button"
        class="yayaw-ft-icon-button"
        :aria-label="props.label('hideDetails')"
        :title="props.label('hideDetails')"
        @click="emit('close')"
      >
        <X aria-hidden="true" />
      </button>
    </header>
    <template v-if="row && record">
      <component :is="() => custom" v-if="custom" />
      <template v-else>
        <div class="yayaw-ft-preview">
          <!-- The thumbnail owns this element's content. -->
          <div ref="preview" class="yayaw-ft-thumb" />
          <FileTreeIcon v-if="!source" :icon="icon" />
        </div>
        <dl>
          <dt>{{ props.label("type") }}</dt>
          <dd>{{ row.folder ? props.label("folder") : props.label("file") }}</dd>
          <dt>{{ props.label("path") }}</dt>
          <dd>{{ props.controller.pathText(props.controller.parentOf(row.id) ?? null) }}</dd>
          <template v-if="row.folder && row.childCount !== undefined">
            <dt>{{ props.label("contents") }}</dt>
            <dd>{{ row.childCount }}</dd>
          </template>
          <template v-for="column in detailColumns" :key="column.id">
            <dt>{{ column.header ?? column.id }}</dt>
            <dd>{{ format(column) }}</dd>
          </template>
        </dl>
      </template>
      <div class="yayaw-ft-details-actions">
        <button
          v-for="item in menu"
          :key="item.key"
          type="button"
          class="yayaw-ft-button"
          :data-variant="item.danger ? 'danger' : undefined"
          @click="emit('menu', item.key, row.id)"
        >
          <component :is="MENU_ICONS[item.key]" aria-hidden="true" />{{ item.label }}
        </button>
      </div>
    </template>
    <p v-else class="yayaw-ft-summary">{{ props.label("noSelection") }}</p>
  </aside>
</template>
