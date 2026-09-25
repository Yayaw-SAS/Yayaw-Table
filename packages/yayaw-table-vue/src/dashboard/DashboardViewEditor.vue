<script setup lang="ts">
/**
 * "Edit view…": a near full-screen dialog (full screen on phones) whose live
 * table of the source is the editor: its toolbar, filters, sort, columns,
 * display modes and their settings, without URL sync, saved views, selection
 * or record changes. "Apply" stores what the table reports; closing with
 * changes asks first.
 */
import { X } from "lucide-vue-next";
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { computed, ref, shallowRef, useId } from "vue";
import YayawDataTable from "../components/YayawDataTable.vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type {
  DataTableTranslations,
  TableActions,
  TableConfig,
  TableRecord,
  TableViewConfig,
} from "../types";
import type { ViewConfig } from "../view-config";
import {
  type DashboardViewEdit,
  dashboardViewEdited,
  dashboardViewEditorActions,
  dashboardViewEditorConfig,
  dashboardViewToApply,
  recordDashboardViewReport,
} from "./dashboard-editor-model";
import type { DashboardInlineView } from "./dashboard-schema";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";

const props = defineProps<{
  /** The source whose table is the editor. */
  source: DashboardTableSource;
  sourceId: string;
  /** Where the editor starts (`dashboardViewEditStart`). */
  start: DashboardViewEdit;
  /** Under the title: the widget or source edited. */
  subtitle: string;
  label: DashboardLabel;
  locale: string;
  renderers?: DisplayModeRenderers;
  getRowId?: (row: TableRecord) => string;
  translations?: DataTableTranslations;
}>();
const emit = defineEmits<{
  /** "Apply": the view to store in `widget.view` (`dashboardViewToApply`). */
  apply: [view: DashboardInlineView];
  close: [];
}>();

// A table of its own for each opening.
const instanceId = `view-editor-${useId()}`;
const edit = shallowRef<DashboardViewEdit>(props.start);
const confirming = ref(false);
const edited = computed(() => dashboardViewEdited(edit.value));
const hostProps = computed(() => props.source.tableProps ?? {});
const config = computed(() => dashboardViewEditorConfig(props.source.config) as TableConfig);
const actions = computed(() => dashboardViewEditorActions(props.source.actions) as TableActions);
const tableProps = computed(() => ({
  tableType: props.sourceId,
  tableId: instanceId,
  instanceId,
  config: config.value,
  getTableActions: () => actions.value,
  initialView: { id: null, config: props.start.initial as TableViewConfig },
  syncUrl: false,
  locale: props.locale,
  translations: (hostProps.value.translations as DataTableTranslations | undefined) ?? props.translations,
  getRowId: (hostProps.value.getRowId as ((row: TableRecord) => string) | undefined) ?? props.getRowId,
  displayModeRenderers: {
    ...props.renderers,
    ...(hostProps.value.displayModeRenderers as DisplayModeRenderers | undefined),
  },
  onViewConfigChange: (view: ViewConfig) => {
    edit.value = recordDashboardViewReport(edit.value, view);
  },
}));
const apply = (): void => {
  const view = dashboardViewToApply(edit.value);
  if (view) emit("apply", view);
  emit("close");
};
const requestClose = (): void => {
  if (edited.value) confirming.value = true;
  else emit("close");
};
/** Escape asks before discarding changes; nested menus close first. */
const onEscape = (event: KeyboardEvent): void => {
  event.preventDefault();
  requestClose();
};
const keepOpen = (event: Event): void => event.preventDefault();
</script>

<template>
  <DialogRoot :open="true">
    <DialogPortal>
      <DialogOverlay class="yayaw-dashboard-view-editor-backdrop" />
      <DialogContent
        class="yayaw-dashboard-view-editor"
        data-view-editor=""
        @escape-key-down="onEscape"
        @pointer-down-outside="keepOpen"
        @interact-outside="keepOpen"
      >
        <DialogDescription class="yayaw-dashboard-sr-only">{{ props.label("viewEditorDescription") }}</DialogDescription>
        <header class="yayaw-dashboard-view-editor-bar" data-view-editor-bar="">
          <div class="yayaw-dashboard-view-editor-heading">
            <DialogTitle as="h2" class="yayaw-dashboard-view-editor-title">{{ props.label("viewEditorTitle") }}</DialogTitle>
            <p class="yayaw-dashboard-view-editor-subtitle">{{ props.subtitle }}</p>
          </div>
          <div class="yayaw-dashboard-view-editor-actions">
            <span v-if="edited" class="yayaw-dashboard-view-editor-status" data-view-editor-status="">
              <span class="yayaw-dashboard-view-editor-dot" aria-hidden="true" />{{ props.label("unsavedChanges") }}
            </span>
            <button type="button" class="yayaw-button" data-view-editor-apply="" :disabled="!edited" @click="apply">
              {{ props.label("apply") }}
            </button>
            <button type="button" class="yayaw-dashboard-icon-button" :aria-label="props.label('close')" @click="requestClose">
              <X :size="16" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div class="yayaw-dashboard-view-editor-table" data-view-editor-table="">
          <YayawDataTable v-bind="tableProps" />
        </div>
        <AlertDialogRoot :open="confirming" @update:open="(open: boolean) => { if (!open) confirming = false; }">
          <AlertDialogPortal>
            <AlertDialogOverlay class="yayaw-dashboard-confirm-backdrop" />
            <AlertDialogContent class="yayaw-dashboard-dialog yayaw-dashboard-confirm" data-view-editor-confirm="">
              <AlertDialogTitle as="h2">{{ props.label("discardTitle") }}</AlertDialogTitle>
              <AlertDialogDescription class="yayaw-dashboard-muted">{{ props.label("discardDescription") }}</AlertDialogDescription>
              <div class="yayaw-dashboard-dialog-footer">
                <button type="button" class="yayaw-button yayaw-button-outline" @click="confirming = false">{{ props.label("keepEditing") }}</button>
                <button type="button" class="yayaw-button yayaw-dashboard-danger" @click="emit('close')">{{ props.label("discard") }}</button>
                <button type="button" class="yayaw-button" @click="apply">{{ props.label("applyAndClose") }}</button>
              </div>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialogRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
