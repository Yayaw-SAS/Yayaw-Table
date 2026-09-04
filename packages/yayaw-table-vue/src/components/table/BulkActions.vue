<script setup lang="ts">
import {
  CheckCheck,
  Copy,
  Download,
  LoaderCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  parseBulkEditPatch,
  resolveBulkActionResult,
} from "../../bulk-actions";
import { commonBulkValues } from "../../bulk-form";
import { cloneFormValue } from "../../form-runtime";
import { useTableContext } from "../../context";
import { downloadCsv } from "../../core";
import type {
  BulkAction,
  BulkActionContext,
  BulkActionHandlerResult,
  TableRecord,
} from "../../types";

const context = useTableContext();
const root = ref<HTMLElement>();
const positionMode = ref<"anchored" | "fixed">("fixed");
let anchorObserver: IntersectionObserver | undefined;
const pending = ref<string>();
const dismissedSelectionKey = ref<string>();
const isBusy = computed(
  () =>
    Boolean(pending.value) ||
    context.isSelectingAll.value ||
    context.form.value.open
);
const confirmation = ref<{
  title: string;
  description?: string;
  confirmLabel?: string;
  execute: () => Promise<void>;
}>();
const editOpen = ref(false);
const editValue = ref("{}");
const editError = ref<string>();
const ids = computed(() =>
  Object.keys(context.selection.value).filter(
    (id) => context.selection.value[id]
  )
);
const selectionKey = computed(() => JSON.stringify([...ids.value].sort()));
watch(selectionKey, () => {
  dismissedSelectionKey.value = undefined;
});
const actionContext = computed<BulkActionContext>(() => ({
  selectedRows: context.selectedRows.value,
  selectedIds: ids.value,
  count: context.selectedRows.value.length,
  clearSelection: context.clearSelection,
  refresh: context.refresh,
}));
const canBulkEdit = computed(
  () =>
    context.config.table.allowBulkEdit &&
    context.selectedRows.value.every(
      (row) => context.config.table.canEditRow?.(row) !== false
    ) &&
    Boolean(context.onBulkEdit || context.actions.value?.bulkUpdate)
);
const canBulkDelete = computed(
  () =>
    context.config.table.allowBulkDelete &&
    Boolean(
      context.onBulkDelete ||
        context.actions.value?.bulkDelete ||
        context.actions.value?.delete
    )
);
const canBulkCopy = computed(() =>
  Boolean(context.onBulkCopy || context.actions.value?.bulkCopy)
);
const translate = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);
onMounted(() => {
  const anchor = root.value
    ?.closest(".yayaw-table")
    ?.querySelector(".yayaw-bulk-anchor");
  if (!(anchor instanceof HTMLElement) || !globalThis.IntersectionObserver) {
    return;
  }
  anchorObserver = new IntersectionObserver(([entry]) => {
    positionMode.value = entry?.isIntersecting ? "anchored" : "fixed";
  });
  anchorObserver.observe(anchor);
});
onBeforeUnmount(() => {
  anchorObserver?.disconnect();
});
const customActionDisabled = (action: BulkAction): boolean => {
  const disabled =
    typeof action.disabled === "function"
      ? action.disabled(actionContext.value)
      : action.disabled;
  return Boolean(disabled || isBusy.value);
};
const clearSelectedIds = (selectedIds: string[]): void => {
  const completed = new Set(selectedIds);
  context.selection.value = Object.fromEntries(
    Object.entries(context.selection.value).filter(
      ([id, selected]) => selected && !completed.has(id)
    )
  );
};
const applyResult = (
  result: BulkActionHandlerResult,
  fallback: string,
  selectedIds: string[],
  defaults = { clearSelection: false, closeMenu: true }
): boolean => {
  const resolved = resolveBulkActionResult(
    result || undefined,
    fallback,
    defaults
  );
  if (resolved.message) {
    context.status.value = {
      type: resolved.success ? "success" : "error",
      message: resolved.message,
    };
  } else if (resolved.success) {
    context.status.value = undefined;
  }
  if (resolved.closeMenu) {
    dismissedSelectionKey.value = JSON.stringify([...selectedIds].sort());
  }
  if (resolved.clearSelection) {
    clearSelectedIds(selectedIds);
  }
  return resolved.success;
};
const reportError = (cause: unknown): void => {
  context.status.value = {
    type: "error",
    message: cause instanceof Error ? cause.message : String(cause),
  };
};
const executeCustom = async (id: string): Promise<void> => {
  const action = context.customBulkActions.value.find((item) => item.id === id);
  if (!action || customActionDisabled(action)) {
    return;
  }
  pending.value = id;
  const selectedIds = [...ids.value];
  try {
    const result = await action.handler(actionContext.value);
    applyResult(result, `${action.label} failed`, selectedIds);
  } finally {
    pending.value = undefined;
  }
};
const runCustom = (id: string): void => {
  const action = context.customBulkActions.value.find((item) => item.id === id);
  if (!action || customActionDisabled(action)) {
    return;
  }
  if (action.confirm) {
    confirmation.value = {
      ...action.confirm,
      execute: () => executeCustom(id),
    };
    return;
  }
  executeCustom(id).catch(reportError);
};
const executeBulkDelete = async (
  selectedIds: string[],
  selectedRows: TableRecord[]
): Promise<void> => {
  if (isBusy.value || !canBulkDelete.value) {
    return;
  }
  pending.value = "delete";
  let shouldRefresh = true;
  try {
    if (context.onBulkDelete) {
      const result = await context.onBulkDelete(selectedRows);
      shouldRefresh = result !== undefined;
      applyResult(result, "Bulk delete failed", selectedIds, {
        clearSelection: Boolean(result),
        closeMenu: Boolean(result),
      });
    } else if (context.actions.value?.bulkDelete) {
      const result = await context.actions.value.bulkDelete(selectedIds);
      applyResult(result, "Bulk delete failed", selectedIds, {
        clearSelection: true,
        closeMenu: true,
      });
    } else if (context.actions.value?.delete) {
      const deleteRow = context.actions.value.delete;
      // Wait for every request before refreshing; a rejected request must not hide later successes.
      const results = await Promise.allSettled(
        selectedIds.map(async (id) => ({ id, result: await deleteRow(id) }))
      );
      const completedIds: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.result.success) {
          completedIds.push(result.value.id);
        }
      }
      clearSelectedIds(completedIds);
      const failedCount = selectedIds.length - completedIds.length;
      if (failedCount) {
        throw new Error(
          `${failedCount} of ${selectedIds.length} rows could not be deleted`
        );
      }
    }
  } catch (cause) {
    reportError(cause);
  } finally {
    // Bulk endpoints can also partially mutate data before reporting an error.
    try {
      if (shouldRefresh) {
        await context.refresh();
      }
    } catch (cause) {
      reportError(cause);
    } finally {
      pending.value = undefined;
    }
  }
};
const requestBulkDelete = (): void => {
  if (isBusy.value || !canBulkDelete.value) {
    return;
  }
  const selectedIds = [...ids.value];
  const selectedRows = [...context.selectedRows.value];
  confirmation.value = {
    title: `Delete ${selectedIds.length} rows?`,
    description: "This action cannot be undone.",
    confirmLabel: translate("delete", "Delete"),
    execute: () => executeBulkDelete(selectedIds, selectedRows),
  };
};
const confirmPendingAction = async (): Promise<void> => {
  const request = confirmation.value;
  confirmation.value = undefined;
  try {
    await request?.execute();
  } catch (cause) {
    reportError(cause);
  }
};
const selectAllMatching = async (): Promise<void> => {
  if (isBusy.value) {
    return;
  }
  try {
    await context.selectAllMatching();
  } catch (cause) {
    reportError(cause);
  }
};
const bulkCopy = async (): Promise<void> => {
  if (!canBulkCopy.value || isBusy.value) {
    return;
  }
  pending.value = "copy";
  const selectedIds = [...ids.value];
  try {
    const result = context.onBulkCopy
      ? await context.onBulkCopy(context.selectedRows.value)
      : await context.actions.value?.bulkCopy?.(selectedIds);
    applyResult(result, "Bulk copy failed", selectedIds);
    if (!context.onBulkCopy) {
      await context.refresh();
    }
  } catch (cause) {
    reportError(cause);
  } finally {
    pending.value = undefined;
  }
};
const bulkEdit = async (): Promise<void> => {
  if (!canBulkEdit.value || isBusy.value) {
    return;
  }
  if (context.onBulkEdit) {
    pending.value = "edit";
    const selectedIds = [...ids.value];
    try {
      // The application owns its edit form and any later persistence or refresh.
      const result = await context.onBulkEdit(context.selectedRows.value);
      applyResult(result, "Bulk update failed", selectedIds);
    } catch (cause) {
      reportError(cause);
    } finally {
      pending.value = undefined;
    }
    return;
  }
  const mode =
    context.config.form?.bulkEditMode ??
    (context.getFormConfig ? "catalogue" : "json");
  if (mode === "catalogue") {
    const rows = context.selectedRows.value;
    if (!rows.length || rows.length !== ids.value.length) {
      context.status.value = { type: "error", message: translate("bulkEditDenied", "These rows can no longer be edited.") };
      return;
    }
    const formTypes = new Set(
      rows.map(
        (row) =>
          context.config.form?.resolveEditFormType?.(row) ??
          context.config.form?.editFormType ??
          context.formType ??
          context.tableType ??
          context.config.id
      )
    );
    if (formTypes.size !== 1) {
      context.status.value = {
        type: "error",
        message: translate(
          "bulkMixedForms",
          "Select rows with the same edit form."
        ),
      };
      return;
    }
    context.form.value = {
      open: true,
      returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
      mode: "edit",
      row: commonBulkValues(rows),
      formType: [...formTypes][0],
      bulk: {
        ids: [...ids.value],
        rows: cloneFormValue(rows),
        completed: clearSelectedIds,
      },
    };
    return;
  }
  editValue.value = "{}";
  editError.value = undefined;
  editOpen.value = true;
};
const applyBulkEdit = async (): Promise<void> => {
  if (isBusy.value || !canBulkEdit.value || !editOpen.value) {
    return;
  }
  let patch: TableRecord;
  try {
    patch = parseBulkEditPatch(editValue.value);
  } catch {
    editError.value = "Enter a valid JSON object.";
    return;
  }
  editError.value = undefined;
  pending.value = "edit";
  const selectedIds = [...ids.value];
  try {
    const result = await context.actions.value?.bulkUpdate?.(
      selectedIds,
      patch
    );
    if (applyResult(result, "Bulk update failed", selectedIds)) {
      editOpen.value = false;
      await context.refresh();
    } else {
      editError.value = context.status.value?.message;
    }
  } catch (cause) {
    reportError(cause);
    editError.value = context.status.value?.message;
  } finally {
    pending.value = undefined;
  }
};
const bulkExport = async (): Promise<void> => {
  if (isBusy.value || !context.config.table.bulkExport) {
    return;
  }
  pending.value = "export";
  const selectedIds = [...ids.value];
  try {
    if (context.onBulkExport) {
      applyResult(
        await context.onBulkExport(context.selectedRows.value),
        "Bulk export failed",
        selectedIds
      );
      return;
    }
    downloadCsv(
      context.selectedRows.value,
      context.config.columns.definitions,
      `${context.config.id}-selection`
    );
    applyResult(
      { success: true, clearSelection: false, closeMenu: true },
      "Bulk export failed",
      selectedIds
    );
  } catch (cause) {
    reportError(cause);
  } finally {
    pending.value = undefined;
  }
};
</script>

<template>
  <div
    v-if="dismissedSelectionKey !== selectionKey"
    ref="root"
    class="yayaw-bulk-menu-wrapper"
    :data-position="positionMode"
  >
    <div
      class="yayaw-bulk-bar"
      role="toolbar"
      :aria-label="translate('actions', 'Bulk actions')"
    >
      <div class="yayaw-bulk-count">
        <span class="yayaw-bulk-count-dot" aria-hidden="true" />
        <strong
          >{{ ids.length }} {{ context.translations.value.selected }}</strong
        >
      </div>

      <button
        v-if="
          context.config.table.enableMultiRowSelection &&
          context.matchingRowCount.value > ids.length
        "
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="isBusy"
        :aria-label="`${translate('selectAll', 'Select all')} ${
          context.matchingRowCount.value
        }`"
        :title="`${translate('selectAll', 'Select all')} ${
          context.matchingRowCount.value
        }`"
        @click="selectAllMatching"
      >
        <LoaderCircle
          v-if="context.isSelectingAll.value"
          :size="20"
          class="yayaw-spin"
          aria-hidden="true"
        />
        <CheckCheck v-else :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">
          {{ translate("selectAll", "Select all") }}
          {{ context.matchingRowCount.value }}
        </span>
      </button>

      <button
        v-if="context.config.table.bulkExport"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="isBusy"
        :aria-label="translate('export', 'Export')"
        :title="translate('export', 'Export')"
        @click="bulkExport"
      >
        <Download :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{
          translate("export", "Export")
        }}</span>
      </button>

      <button
        v-if="canBulkEdit"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="isBusy"
        :aria-label="translate('bulkEdit', 'Bulk edit')"
        :title="translate('bulkEdit', 'Bulk edit')"
        @click="bulkEdit"
      >
        <Pencil :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{
          translate("bulkEdit", "Bulk edit")
        }}</span>
      </button>

      <button
        v-if="canBulkCopy"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="isBusy"
        :aria-label="translate('copy', 'Copy')"
        :title="translate('copy', 'Copy')"
        @click="bulkCopy"
      >
        <Copy :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{
          translate("copy", "Copy")
        }}</span>
      </button>

      <button
        v-for="action in context.customBulkActions.value"
        :key="action.id"
        type="button"
        class="yayaw-bulk-action-tab"
        :class="{ 'yayaw-bulk-action-danger': action.variant === 'danger' }"
        :disabled="customActionDisabled(action)"
        :aria-label="action.label"
        :title="action.label"
        @click="runCustom(action.id)"
      >
        <LoaderCircle
          v-if="pending === action.id"
          :size="20"
          class="yayaw-spin"
          aria-hidden="true"
        />
        <component
          :is="action.icon"
          v-else-if="action.icon"
          :size="20"
          aria-hidden="true"
        />
        <span v-else class="yayaw-bulk-action-fallback" aria-hidden="true">
          {{ action.label.slice(0, 1) }}
        </span>
        <span class="yayaw-bulk-action-label">{{ action.label }}</span>
      </button>

      <button
        v-if="canBulkDelete"
        type="button"
        class="yayaw-bulk-action-tab yayaw-bulk-action-danger"
        :disabled="isBusy"
        :aria-label="translate('delete', 'Delete')"
        :title="translate('delete', 'Delete')"
        @click="requestBulkDelete"
      >
        <Trash2 :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{
          translate("delete", "Delete")
        }}</span>
      </button>

      <span class="yayaw-bulk-divider" aria-hidden="true" />
      <button
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="isBusy"
        :aria-label="translate('cancel', 'Clear selection')"
        :title="translate('cancel', 'Clear selection')"
        @click="context.clearSelection"
      >
        <X :size="12" aria-hidden="true" />
      </button>
    </div>
  </div>

  <div
    v-if="confirmation"
    class="yayaw-dialog-backdrop"
    @mousedown.self="confirmation = undefined"
  >
    <section
      class="yayaw-form-surface yayaw-confirm-surface"
      data-presentation="modal"
      role="alertdialog"
      aria-modal="true"
      :aria-label="confirmation.title"
    >
      <header class="yayaw-form-header">
        <div>
          <h3>{{ confirmation.title }}</h3>
          <p v-if="confirmation.description">{{ confirmation.description }}</p>
        </div>
      </header>
      <div class="yayaw-confirm-body">
        <button
          type="button"
          class="yayaw-button yayaw-button-outline"
          @click="confirmation = undefined"
        >
          {{ translate("cancel", "Cancel") }}
        </button>
        <button
          type="button"
          class="yayaw-button yayaw-button-danger"
          @click="confirmPendingAction"
        >
          {{ confirmation.confirmLabel ?? translate("confirm", "Confirm") }}
        </button>
      </div>
    </section>
  </div>

  <div
    v-if="editOpen"
    class="yayaw-dialog-backdrop"
    @mousedown.self="!isBusy && (editOpen = false)"
  >
    <section
      class="yayaw-form-surface yayaw-confirm-surface"
      data-presentation="modal"
      role="dialog"
      aria-modal="true"
      :aria-label="translate('bulkEdit', 'Bulk edit')"
    >
      <header class="yayaw-form-header">
        <div>
          <h3>{{ translate("bulkEdit", "Bulk edit") }}</h3>
          <p>JSON fields to update on {{ ids.length }} rows.</p>
        </div>
      </header>
      <div class="yayaw-confirm-body yayaw-bulk-editor">
        <textarea
          v-model="editValue"
          :disabled="isBusy"
          class="yayaw-textarea yayaw-json-editor"
          rows="8"
          aria-label="JSON fields"
        />
        <p v-if="editError" class="yayaw-field-error" role="alert">
          {{ editError }}
        </p>
        <div class="yayaw-form-footer">
          <button
            type="button"
            class="yayaw-button yayaw-button-outline"
            :disabled="isBusy"
            @click="editOpen = false"
          >
            {{ translate("cancel", "Cancel") }}
          </button>
          <button
            type="button"
            class="yayaw-button"
            :disabled="isBusy"
            @click="applyBulkEdit"
          >
            {{ translate("confirm", "Apply") }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
