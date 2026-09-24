<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderInput,
  FolderPlus,
  FolderTree,
  PanelRight,
  Trash2,
} from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { toast } from "vue-sonner";
import TableCheckbox from "../components/controls/TableCheckbox.vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import {
  FileTreeController,
  type FileTreeControllerOptions,
  type FileTreeEvents,
  type FileTreeMenuKey,
  type FileTreeNotification,
} from "../filetree-controller";
import {
  attachFileTreeDrag,
  attachFileTreeFileDrop,
  FILETREE_DETAILS_DEFAULT,
} from "../filetree-dom";
import {
  FILETREE_ROOT_TARGET,
  FILETREE_ROW_ATTRIBUTE,
  FILETREE_ROW_HEIGHT,
  FILETREE_UNFILED,
  FILETREE_WINDOW_THRESHOLD,
  type FileTreeColumn,
  type FileTreeHooks,
  type FileTreeLabelKey,
  type FileTreeNodeRow,
  type FileTreeViewSettings,
  fileTreeDropMark,
  fileTreeGridColumns,
  fileTreeLabel,
  fileTreeScrollTo,
  fileTreeSummary,
  fileTreeWindow,
  readFileTreeFolderParam,
  resolveFileTreeSettings,
  writeFileTreeFolderParam,
} from "../filetree-model";
import { resolveGalleryMedia } from "../media-contract";
import { mediaViewerLabels, openMediaViewer } from "../media-viewer";
import "../filetree.css";
import "../media-viewer.css";
import type { TableRecord } from "../types";
import FileTreeDeleteDialog from "./FileTreeDeleteDialog.vue";
import FileTreeDetails from "./FileTreeDetails.vue";
import FileTreeMoveDialog from "./FileTreeMoveDialog.vue";
import FileTreeRow from "./FileTreeRow.vue";
import FileTreeStatusRow from "./FileTreeStatusRow.vue";

/** File tree display mode: folders and files as a tree table, with a details pane. */
const props = defineProps<{ context: DisplayModeRenderContext }>();
const PHONE_QUERY = "(max-width: 767px)";

const settings = computed(() =>
  resolveFileTreeSettings(
    props.context.columns as FileTreeColumn[],
    props.context.defaults as FileTreeViewSettings,
    props.context.settings as FileTreeViewSettings
  )
);
const hooks = computed(() => props.context.defaults as FileTreeHooks);
const query = computed(() => String(props.context.listParams.search ?? ""));
const label = (key: FileTreeLabelKey, params?: Record<string, string | number>): string =>
  fileTreeLabel(
    key,
    props.context.locale,
    (name, fallback) => props.context.translate(`filetree.${name}`, fallback),
    params
  );

const root = ref<HTMLElement>();
const scroller = ref<HTMLElement>();
const menuId = ref<string>();
const deleteIds = ref<string[]>();
const moveIds = ref<string[]>();
const detailsWidth = ref(FILETREE_DETAILS_DEFAULT);
const scrollTop = ref(0);
const viewport = ref(600);
const phone = ref(false);

const notify = (notification: FileTreeNotification): void => {
  const { message, type, undo, undoLabel } = notification;
  if (type === "error") {
    toast.error(message);
    return;
  }
  const action = undo ? { label: undoLabel ?? "Undo", onClick: undo } : undefined;
  if (type === "info") {
    toast.info(message, { action });
    return;
  }
  toast.success(message, { action });
};

const mediaOf = (row: TableRecord) =>
  props.context.media?.enabled
    ? resolveGalleryMedia(row, props.context.media, props.context.imageColumn)
    : undefined;

let viewer: ReturnType<typeof openMediaViewer> | undefined;
const showDetails = (id: string): void => {
  controller.focus(id);
  if (!settings.value.showDetails) {
    props.context.updateSettings({ ...props.context.settings, showDetails: true });
  }
};
/** Media files open in the viewer with their siblings; other records open like a row click. */
const openFile = (row: TableRecord): void => {
  if (!mediaOf(row)) {
    props.context.openRow(row);
    return;
  }
  const files = controller
    .getState()
    .rows.filter((item): item is FileTreeNodeRow => item.type === "node" && !item.folder)
    .flatMap((item) => {
      const record = controller.row(item.id);
      return record && mediaOf(record) ? [record] : [];
    });
  const items = files.includes(row) ? files : [row, ...files];
  const active = document.activeElement;
  viewer?.destroy();
  viewer = openMediaViewer({
    items: items.map((item) => ({
      id: props.context.getRowId(item),
      title: String(item[settings.value.nameColumn] ?? ""),
      source: mediaOf(item),
    })),
    index: items.indexOf(row),
    labels: mediaViewerLabels(props.context.locale),
    returnFocus: active instanceof HTMLElement ? active : undefined,
    onInfo: showDetails,
  });
};

const pendingFocus = ref<string>();
const events: FileTreeEvents = {
  open: (row) => openFile(row),
  notify,
  focus: (id) => {
    pendingFocus.value = id;
  },
  persist: (state) =>
    props.context.updateSettings({ ...props.context.settings, ...state }),
  folder: (id) => {
    if (props.context.syncUrl) {
      writeFileTreeFolderParam(props.context.tableId, id);
    }
  },
  requestDelete: (ids) => {
    deleteIds.value = ids;
  },
  menu: (id) => {
    menuId.value = id;
  },
  refresh: () => props.context.refresh(),
};

const options = computed<FileTreeControllerOptions>(() => {
  const { context } = props;
  return {
    list: context.list as FileTreeControllerOptions["list"],
    rows: context.rows,
    params: context.listParams,
    settings: {
      ...settings.value,
      rootLabel: settings.value.rootLabel ?? context.title,
    },
    hooks: hooks.value,
    getRowId: context.getRowId,
    tree: context.tree,
    patchRow: context.patchRow,
    createRecord: async (values) => {
      const result = await context.createRecord(values);
      return { success: result.ok === true, error: result.ok ? undefined : result.message };
    },
    deleteRow: context.deleteRow,
    canEditRow: context.canEditRow,
    canDeleteRow: context.canDeleteRow,
    canCreate: context.canCreate,
    multiple: context.selection.multiple,
    locale: context.locale,
    translate: (key, fallback) => context.translate(`filetree.${key}`, fallback),
    revision: context.revision,
    events,
  };
});
const controller = new FileTreeController(options.value);
const state = shallowRef(controller.getState());
const unsubscribe = controller.subscribe(() => {
  state.value = controller.getState();
});
watch(options, (next) => controller.setOptions(next));

let media: MediaQueryList | undefined;
const syncPhone = (): void => {
  phone.value = Boolean(media?.matches);
  controller.setPhone(phone.value);
};
let cleanups: (() => void)[] = [];
onMounted(() => {
  media = typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY) : undefined;
  media?.addEventListener("change", syncPhone);
  syncPhone();
  controller.start(
    props.context.syncUrl ? readFileTreeFolderParam(props.context.tableId) : undefined
  );
  if (root.value) {
    cleanups = [
      attachFileTreeDrag(root.value, controller, () => !phone.value),
      attachFileTreeFileDrop(root.value, controller, () => Boolean(hooks.value.onDropFiles)),
    ];
  }
});
onBeforeUnmount(() => {
  media?.removeEventListener("change", syncPhone);
  for (const cleanup of cleanups) {
    cleanup();
  }
  unsubscribe();
  controller.dispose();
  viewer?.destroy();
});

const windowed = computed(() => state.value.rows.length > FILETREE_WINDOW_THRESHOLD);
const range = computed(() =>
  windowed.value
    ? fileTreeWindow({
        count: state.value.rows.length,
        rowHeight: FILETREE_ROW_HEIGHT,
        scrollTop: scrollTop.value,
        viewport: viewport.value,
      })
    : { start: 0, end: state.value.rows.length, before: 0, after: 0 }
);
const visibleRows = computed(() => state.value.rows.slice(range.value.start, range.value.end));
watch(windowed, async () => {
  await nextTick();
  viewport.value = scroller.value?.clientHeight || 600;
});

const cssEscape = (value: string): string =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;
watch(
  [pendingFocus, () => state.value.rows],
  async () => {
    const id = pendingFocus.value;
    if (!id) {
      return;
    }
    const index = state.value.rows.findIndex((row) => row.id === id);
    const element = scroller.value;
    if (windowed.value && element && index >= 0) {
      const next = fileTreeScrollTo(index, FILETREE_ROW_HEIGHT, element.scrollTop, element.clientHeight);
      if (next !== element.scrollTop) {
        element.scrollTop = next;
        scrollTop.value = next;
      }
    }
    await nextTick();
    const row = root.value?.querySelector<HTMLElement>(
      `[role="row"][${FILETREE_ROW_ATTRIBUTE}="${cssEscape(id)}"]`
    );
    row?.focus({ preventScroll: windowed.value });
    if (!windowed.value) {
      row?.scrollIntoView?.({ block: "nearest" });
    }
    pendingFocus.value = undefined;
  },
  { flush: "post" }
);

const onMenu = (key: FileTreeMenuKey, id: string): void => {
  const row = controller.row(id);
  const handlers: Record<FileTreeMenuKey, () => void> = {
    info: () => showDetails(id),
    preview: () => {
      if (row) openFile(row);
    },
    open: () => {
      if (row) props.context.openRow(row);
    },
    rename: () => controller.startRename(id),
    move: () => {
      moveIds.value = controller.actionIds(id);
    },
    "new-folder": () => controller.startCreateFolder(id),
    delete: () => controller.requestDelete(id),
  };
  handlers[key]();
};

const onKeydown = (event: KeyboardEvent): void => {
  const target = event.target as HTMLElement;
  if (target.getAttribute("role") !== "row") {
    return;
  }
  if (controller.keydown(event)) {
    event.preventDefault();
  }
};

const selectable = computed(() => props.context.selection.enabled);
const columns = computed(() =>
  settings.value.columns.flatMap((id) =>
    props.context.columns.filter((column) => column.id === id)
  )
);
const grid = computed(() => fileTreeGridColumns(columns.value.length, selectable.value));
const detailsOpen = computed(() => settings.value.showDetails && !phone.value);
const rootStyle = computed(() => ({
  "--ft-columns": grid.value.full,
  "--ft-columns-compact": grid.value.compact,
  "--ft-details-width": `${detailsWidth.value}px`,
}));
const nodes = computed(() =>
  state.value.rows.filter((row) => row.type === "node" && row.id !== FILETREE_UNFILED)
);
const allSelected = computed(
  () => nodes.value.length > 0 && nodes.value.every((row) => state.value.selection.has(row.id))
);
const empty = computed(
  () =>
    state.value.status === "ready" &&
    state.value.rows.every(
      (row) => row.type !== "node" && row.type !== "loading" && row.type !== "draft"
    )
);
const summary = computed(() =>
  fileTreeSummary(state.value.summary, props.context.locale, (key, fallback) =>
    props.context.translate(`filetree.${key}`, fallback)
  )
);
const uploads = computed(() =>
  [...state.value.uploads.values()].reduce((sum, count) => sum + count, 0)
);
const selectedIds = computed(() => [...state.value.selection]);
const sortState = (id: string) => {
  const sort = settings.value.sort;
  const active = sort?.id === id || (!sort && id === settings.value.nameColumn);
  const desc = active && Boolean(sort?.desc);
  let aria: "ascending" | "descending" | undefined;
  if (active) {
    aria = desc ? "descending" : "ascending";
  }
  return { active, desc, aria };
};
const toggleSort = (id: string): void => {
  const sort = settings.value.sort;
  const next = sort?.id === id ? { id, desc: !sort.desc } : { id, desc: false };
  props.context.updateSettings({ ...props.context.settings, sort: next });
};
const numeric = (column: { id: string; type?: string }) =>
  column.id === settings.value.sizeColumn || column.type === "number";
const hasMedia = (id: string): boolean => {
  const record = controller.row(id);
  return Boolean(record && mediaOf(record));
};
const toggleDetails = (): void =>
  props.context.updateSettings({
    ...props.context.settings,
    showDetails: !settings.value.showDetails,
  });
const crumbClick = (id: string | null): void => {
  if (state.value.phone) {
    controller.drill(id);
  } else if (id) {
    controller.focus(id);
  } else {
    const first = state.value.rows.find((row) => row.type === "node");
    if (first) {
      controller.focus(first.id);
    }
  }
};
</script>

<template>
  <div
    ref="root"
    class="yayaw-ft"
    :data-phone="phone"
    :data-selecting="state.selection.size > 0"
    :style="rootStyle"
  >
    <div class="yayaw-ft-header">
      <div
        class="yayaw-ft-heading"
        :data-filetree-id="FILETREE_ROOT_TARGET"
        :data-ft-drop="fileTreeDropMark(FILETREE_ROOT_TARGET, state.drag)"
      >
        <h3 class="yayaw-ft-title">
          <button
            v-if="state.phone && state.drillId !== null"
            type="button"
            class="yayaw-ft-icon-button"
            :aria-label="label('back')"
            :title="label('back')"
            @click="controller.back()"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <FolderTree v-else aria-hidden="true" :size="16" />
          {{ controller.rootLabel() }}
        </h3>
        <p class="yayaw-ft-summary">{{ summary }}</p>
      </div>
      <div class="yayaw-ft-actions">
        <button
          type="button"
          class="yayaw-ft-button"
          :disabled="!controller.canCreateFolderIn(controller.newFolderParent()) || state.busy"
          @click="controller.startCreateFolder()"
        >
          <FolderPlus aria-hidden="true" />{{ label("newFolder") }}
        </button>
        <template v-if="!state.phone">
          <button
            type="button"
            class="yayaw-ft-button"
            aria-keyshortcuts="Alt+Shift+ArrowDown"
            :disabled="!state.canExpandAll || state.expanding"
            @click="controller.expandAll().catch(() => undefined)"
          >
            <ChevronsUpDown aria-hidden="true" />{{ label("expandAll") }}
          </button>
          <button
            type="button"
            class="yayaw-ft-button"
            aria-keyshortcuts="Alt+Shift+ArrowUp"
            :disabled="!state.canCollapseAll"
            @click="controller.collapseAll()"
          >
            <ChevronsDownUp aria-hidden="true" />{{ label("collapseAll") }}
          </button>
          <button type="button" class="yayaw-ft-button" :aria-pressed="detailsOpen" @click="toggleDetails">
            <PanelRight aria-hidden="true" />{{ label("details") }}
          </button>
        </template>
      </div>
    </div>
    <nav class="yayaw-ft-crumbs" :aria-label="label('path')">
      <ol>
        <li v-for="(crumb, index) in state.crumbs" :key="crumb.id ?? '__root'">
          <button
            type="button"
            :aria-current="index === state.crumbs.length - 1 ? 'page' : undefined"
            @click="crumbClick(crumb.id)"
          >
            {{ crumb.name }}
          </button>
        </li>
      </ol>
    </nav>
    <div v-if="state.notice" class="yayaw-ft-notice" role="status">{{ state.notice }}</div>
    <div v-if="uploads" class="yayaw-ft-notice" role="status">{{ label("uploading", { count: uploads }) }}</div>
    <div class="yayaw-ft-body" :data-details="detailsOpen">
      <div class="yayaw-ft-card">
        <div
          ref="scroller"
          class="yayaw-ft-scroll"
          :data-windowed="windowed"
          @scroll="scrollTop = ($event.currentTarget as HTMLElement).scrollTop"
        >
          <div v-if="state.status === 'error'" class="yayaw-ft-empty" role="alert">{{ state.error }}</div>
          <div
            v-else
            class="yayaw-ft-grid"
            role="treegrid"
            :aria-busy="state.status === 'loading'"
            :aria-label="controller.rootLabel()"
            :aria-multiselectable="props.context.selection.multiple"
            @keydown="onKeydown"
          >
            <div class="yayaw-ft-row yayaw-ft-head" role="row">
              <div v-if="selectable" class="yayaw-ft-cell yayaw-ft-check" role="columnheader">
                <TableCheckbox
                  :label="label('selectAll')"
                  :model-value="allSelected"
                  :disabled="!(props.context.selection.multiple && nodes.length)"
                  tabindex="-1"
                  @update:model-value="(checked) => (checked ? controller.selectAll() : controller.clearSelection())"
                />
              </div>
              <div
                class="yayaw-ft-cell"
                role="columnheader"
                :aria-sort="sortState(settings.nameColumn).aria"
              >
                <button
                  type="button"
                  class="yayaw-ft-sort"
                  tabindex="-1"
                  :aria-label="label('sortBy', { name: label('name') })"
                  @click="toggleSort(settings.nameColumn)"
                >
                  {{ label("name") }}
                  <template v-if="sortState(settings.nameColumn).active">
                    <ArrowDown v-if="sortState(settings.nameColumn).desc" aria-hidden="true" />
                    <ArrowUp v-else aria-hidden="true" />
                  </template>
                </button>
              </div>
              <div
                v-for="column in columns"
                :key="column.id"
                class="yayaw-ft-cell"
                role="columnheader"
                data-optional="true"
                :data-align="numeric(column) ? 'end' : undefined"
                :aria-sort="sortState(column.id).aria"
              >
                <button
                  type="button"
                  class="yayaw-ft-sort"
                  tabindex="-1"
                  :aria-label="label('sortBy', { name: column.header ?? column.id })"
                  @click="toggleSort(column.id)"
                >
                  {{ column.header ?? column.id }}
                  <template v-if="sortState(column.id).active">
                    <ArrowDown v-if="sortState(column.id).desc" aria-hidden="true" />
                    <ArrowUp v-else aria-hidden="true" />
                  </template>
                </button>
              </div>
              <div class="yayaw-ft-cell yayaw-ft-menu" role="columnheader">
                <span class="yayaw-ft-sr">{{ label("actions") }}</span>
              </div>
            </div>
            <div v-if="empty" class="yayaw-ft-empty" role="row">
              <span role="gridcell">{{ state.searching ? label("noMatches") : label("empty") }}</span>
            </div>
            <div v-if="range.before" aria-hidden="true" :style="{ height: `${range.before}px` }" />
            <template v-for="row in visibleRows" :key="row.id">
              <FileTreeRow
                v-if="row.type === 'node'"
                :row="row"
                :state="state"
                :controller="controller"
                :context="props.context"
                :settings="settings"
                :columns="columns"
                :selectable="selectable"
                :query="query"
                :label="label"
                :has-media="hasMedia(row.id)"
                :menu-open="menuId === row.id"
                @menu="onMenu"
                @menu-open="(open) => (menuId = open ? row.id : undefined)"
              />
              <FileTreeStatusRow v-else :row="row" :controller="controller" :label="label" />
            </template>
            <div v-if="range.after" aria-hidden="true" :style="{ height: `${range.after}px` }" />
          </div>
        </div>
      </div>
      <FileTreeDetails
        v-if="detailsOpen"
        :state="state"
        :controller="controller"
        :context="props.context"
        :settings="settings"
        :columns="columns"
        :width="detailsWidth"
        :label="label"
        @close="props.context.updateSettings({ ...props.context.settings, showDetails: false })"
        @width="(width) => (detailsWidth = width)"
        @menu="onMenu"
        @open="openFile"
      />
    </div>
    <div v-if="state.selection.size" class="yayaw-ft-selection">
      <strong>{{ label("selected", { count: state.selection.size }) }}</strong>
      <button
        v-if="controller.canMoveIds(selectedIds)"
        type="button"
        class="yayaw-ft-button"
        @click="moveIds = selectedIds"
      >
        <FolderInput aria-hidden="true" />{{ label("moveTo") }}
      </button>
      <button
        v-if="controller.canDelete(selectedIds)"
        type="button"
        class="yayaw-ft-button"
        @click="controller.requestDelete()"
      >
        <Trash2 aria-hidden="true" />{{ label("delete") }}
      </button>
      <button type="button" class="yayaw-ft-button" @click="controller.clearSelection()">
        {{ label("clearSelection") }}
      </button>
    </div>
    <div class="yayaw-ft-sr" aria-live="polite">{{ state.announcement }}</div>
    <FileTreeMoveDialog
      v-if="moveIds"
      :controller="controller"
      :ids="moveIds"
      :label="label"
      :version="state.version"
      @close="moveIds = undefined"
    />
    <FileTreeDeleteDialog
      v-if="deleteIds"
      :controller="controller"
      :ids="deleteIds"
      :label="label"
      @close="deleteIds = undefined"
    />
  </div>
</template>
