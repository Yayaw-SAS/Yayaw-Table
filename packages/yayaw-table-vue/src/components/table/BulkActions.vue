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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import { downloadCsv } from "../../core";
import type { BulkAction, BulkActionContext, TableRecord } from "../../types";

const context = useTableContext();
const root = ref<HTMLElement>();
const positionMode = ref<"anchored" | "fixed">("fixed");
let anchorObserver: IntersectionObserver | undefined;
const pending = ref<string>();
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
  return Boolean(disabled || pending.value);
};
const assertSuccess = (result: unknown, fallback: string): void => {
  if (
    result &&
    typeof result === "object" &&
    "success" in result &&
    (result as { success?: boolean }).success === false
  ) {
    throw new Error(String((result as { error?: unknown }).error ?? fallback));
  }
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
  try {
    const result = await action.handler(actionContext.value);
    assertSuccess(result, `${action.label} failed`);
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
const executeBulkDelete = async (): Promise<void> => {
  pending.value = "delete";
  try {
    if (context.onBulkDelete) {
      assertSuccess(
        await context.onBulkDelete(context.selectedRows.value),
        "Bulk delete failed"
      );
    } else if (context.actions.value?.bulkDelete) {
      const result = await context.actions.value.bulkDelete(ids.value);
      assertSuccess(result, "Bulk delete failed");
    } else if (context.actions.value?.delete) {
      const results = await Promise.all(
        ids.value.map((id) => context.actions.value?.delete?.(id))
      );
      const failed = results.filter((result) => !result?.success);
      if (failed.length) {
        throw new Error(`${failed.length} rows could not be deleted`);
      }
    }
    context.clearSelection();
    await context.refresh();
  } catch (cause) {
    reportError(cause);
  } finally {
    pending.value = undefined;
  }
};
const requestBulkDelete = (): void => {
  confirmation.value = {
    title: `Delete ${ids.value.length} rows?`,
    description: "This action cannot be undone.",
    confirmLabel: translate("delete", "Delete"),
    execute: executeBulkDelete,
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
  try {
    await context.selectAllMatching();
  } catch (cause) {
    reportError(cause);
  }
};
const bulkCopy = async (): Promise<void> => {
  if (!canBulkCopy.value) {
    return;
  }
  pending.value = "copy";
  try {
    const result = context.onBulkCopy
      ? await context.onBulkCopy(context.selectedRows.value)
      : await context.actions.value?.bulkCopy?.(ids.value);
    assertSuccess(result, "Bulk copy failed");
    await context.refresh();
  } catch (cause) {
    reportError(cause);
  } finally {
    pending.value = undefined;
  }
};
const bulkEdit = (): void => {
  if (!canBulkEdit.value) {
    return;
  }
  editValue.value = "{}";
  editError.value = undefined;
  editOpen.value = true;
};
const applyBulkEdit = async (): Promise<void> => {
  let patch: TableRecord;
  try {
    patch = JSON.parse(editValue.value) as TableRecord;
  } catch {
    editError.value = "Enter a valid JSON object.";
    return;
  }
  editOpen.value = false;
  pending.value = "edit";
  try {
    const result = context.onBulkEdit
      ? await context.onBulkEdit(context.selectedRows.value, patch)
      : await context.actions.value?.bulkUpdate?.(ids.value, patch);
    assertSuccess(result, "Bulk update failed");
    await context.refresh();
  } catch (cause) {
    reportError(cause);
  } finally {
    pending.value = undefined;
  }
};
const bulkExport = async (): Promise<void> => {
  pending.value = "export";
  try {
    if (context.onBulkExport) {
      assertSuccess(
        await context.onBulkExport(context.selectedRows.value),
        "Bulk export failed"
      );
      return;
    }
    downloadCsv(
      context.selectedRows.value,
      context.config.columns.definitions,
      `${context.config.id}-selection`
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
        <strong>{{ ids.length }} {{ context.translations.value.selected }}</strong>
      </div>

      <button
        v-if="context.config.table.enableMultiRowSelection && context.matchingRowCount.value > ids.length"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="context.isSelectingAll.value || Boolean(pending)"
        :aria-label="`${translate('selectAll', 'Select all')} ${context.matchingRowCount.value}`"
        :title="`${translate('selectAll', 'Select all')} ${context.matchingRowCount.value}`"
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
          {{ translate("selectAll", "Select all") }} {{ context.matchingRowCount.value }}
        </span>
      </button>

      <button
        v-if="context.config.table.bulkExport"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="Boolean(pending)"
        :aria-label="translate('export', 'Export')"
        :title="translate('export', 'Export')"
        @click="bulkExport"
      >
        <Download :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{ translate("export", "Export") }}</span>
      </button>

      <button
        v-if="canBulkEdit"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="Boolean(pending)"
        :aria-label="translate('bulkEdit', 'Bulk edit')"
        :title="translate('bulkEdit', 'Bulk edit')"
        @click="bulkEdit"
      >
        <Pencil :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{ translate("bulkEdit", "Bulk edit") }}</span>
      </button>

      <button
        v-if="canBulkCopy"
        type="button"
        class="yayaw-bulk-action-tab"
        :disabled="Boolean(pending)"
        :aria-label="translate('copy', 'Copy')"
        :title="translate('copy', 'Copy')"
        @click="bulkCopy"
      >
        <Copy :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{ translate("copy", "Copy") }}</span>
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
        :disabled="Boolean(pending)"
        :aria-label="translate('delete', 'Delete')"
        :title="translate('delete', 'Delete')"
        @click="requestBulkDelete"
      >
        <Trash2 :size="20" aria-hidden="true" />
        <span class="yayaw-bulk-action-label">{{ translate("delete", "Delete") }}</span>
      </button>

      <span class="yayaw-bulk-divider" aria-hidden="true" />
      <button
        type="button"
        class="yayaw-bulk-action-tab"
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
    @mousedown.self="editOpen = false"
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
            @click="editOpen = false"
          >
            {{ translate("cancel", "Cancel") }}
          </button>
          <button type="button" class="yayaw-button" @click="applyBulkEdit">
            {{ translate("confirm", "Apply") }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
