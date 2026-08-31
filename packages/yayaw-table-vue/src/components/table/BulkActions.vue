<script setup lang="ts">
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import { downloadCsv } from "../../core";
import type { BulkActionContext, TableRecord } from "../../types";

const context = useTableContext();
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
const executeCustom = async (id: string): Promise<void> => {
  const action = context.customBulkActions.value.find((item) => item.id === id);
  if (!action) {
    return;
  }
  const disabled =
    typeof action.disabled === "function"
      ? action.disabled(actionContext.value)
      : action.disabled;
  if (disabled) {
    return;
  }
  pending.value = id;
  try {
    await action.handler(actionContext.value);
  } finally {
    pending.value = undefined;
  }
};
const runCustom = (id: string): void => {
  const action = context.customBulkActions.value.find((item) => item.id === id);
  if (!action) {
    return;
  }
  if (action.confirm) {
    confirmation.value = {
      ...action.confirm,
      execute: () => executeCustom(id),
    };
    return;
  }
  executeCustom(id).catch((cause: unknown) => {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  });
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
      if (!result.success) {
        throw new Error(result.error ?? "Bulk delete failed");
      }
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
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    pending.value = undefined;
  }
};
const requestBulkDelete = (): void => {
  confirmation.value = {
    title: `Delete ${ids.value.length} rows?`,
    description: "This action cannot be undone.",
    confirmLabel: String(context.translations.value.delete),
    execute: executeBulkDelete,
  };
};
const confirmPendingAction = async (): Promise<void> => {
  const request = confirmation.value;
  confirmation.value = undefined;
  try {
    await request?.execute();
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
};
const bulkCopy = async (): Promise<void> => {
  if (!(context.onBulkCopy || context.actions.value?.bulkCopy)) {
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
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    pending.value = undefined;
  }
};
const bulkEdit = (): void => {
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
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    pending.value = undefined;
  }
};
const bulkExport = async (): Promise<void> => {
  if (context.onBulkExport) {
    pending.value = "export";
    try {
      assertSuccess(
        await context.onBulkExport(context.selectedRows.value),
        "Bulk export failed"
      );
    } catch (cause) {
      context.status.value = {
        type: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      };
    } finally {
      pending.value = undefined;
    }
    return;
  }
  downloadCsv(
    context.selectedRows.value,
    context.config.columns.definitions,
    `${context.config.id}-selection`
  );
};
</script>

<template>
  <div class="yayaw-bulk-bar" role="toolbar" aria-label="Bulk actions">
    <strong>{{ ids.length }} {{ context.translations.value.selected }}</strong>
    <button
      v-if="context.config.table.enableMultiRowSelection && context.matchingRowCount.value > ids.length"
      type="button"
      class="yayaw-button yayaw-button-outline"
      :disabled="context.isSelectingAll.value"
      @click="context.selectAllMatching"
    >{{ context.isSelectingAll.value ? 'Selecting…' : `Select all ${context.matchingRowCount.value}` }}</button>
    <button v-if="context.config.table.bulkExport" type="button" class="yayaw-button yayaw-button-outline" @click="bulkExport">{{ context.translations.value.export }}</button>
    <button v-if="context.config.table.allowBulkEdit && (context.onBulkEdit || context.actions.value?.bulkUpdate)" type="button" class="yayaw-button yayaw-button-outline" :disabled="Boolean(pending)" @click="bulkEdit">Bulk edit</button>
    <button v-if="context.onBulkCopy || context.actions.value?.bulkCopy" type="button" class="yayaw-button yayaw-button-outline" :disabled="Boolean(pending)" @click="bulkCopy">Copy</button>
    <button v-for="action in context.customBulkActions.value" :key="action.id" type="button" class="yayaw-button yayaw-button-outline" :disabled="Boolean(pending)" @click="runCustom(action.id)">{{ pending === action.id ? '…' : action.label }}</button>
    <button v-if="context.config.table.allowBulkDelete && (context.onBulkDelete || context.actions.value?.bulkDelete || context.actions.value?.delete)" type="button" class="yayaw-button yayaw-button-danger" :disabled="Boolean(pending)" @click="requestBulkDelete">{{ context.translations.value.delete }}</button>
    <button type="button" class="yayaw-icon-button" aria-label="Clear selection" @click="context.clearSelection">×</button>
  </div>
  <div v-if="confirmation" class="yayaw-dialog-backdrop" @mousedown.self="confirmation = undefined">
    <section class="yayaw-form-surface yayaw-confirm-surface" data-presentation="modal" role="alertdialog" aria-modal="true" :aria-label="confirmation.title">
      <header class="yayaw-form-header"><div><h3>{{ confirmation.title }}</h3><p v-if="confirmation.description">{{ confirmation.description }}</p></div></header>
      <div class="yayaw-confirm-body">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="confirmation = undefined">Cancel</button>
        <button type="button" class="yayaw-button yayaw-button-danger" @click="confirmPendingAction">{{ confirmation.confirmLabel ?? 'Confirm' }}</button>
      </div>
    </section>
  </div>
  <div v-if="editOpen" class="yayaw-dialog-backdrop" @mousedown.self="editOpen = false">
    <section class="yayaw-form-surface yayaw-confirm-surface" data-presentation="modal" role="dialog" aria-modal="true" aria-label="Bulk edit">
      <header class="yayaw-form-header"><div><h3>Bulk edit</h3><p>JSON fields to update on {{ ids.length }} rows.</p></div></header>
      <div class="yayaw-confirm-body yayaw-bulk-editor">
        <textarea v-model="editValue" class="yayaw-textarea yayaw-json-editor" rows="8" aria-label="JSON fields" />
        <p v-if="editError" class="yayaw-field-error" role="alert">{{ editError }}</p>
        <div class="yayaw-form-footer">
          <button type="button" class="yayaw-button yayaw-button-outline" @click="editOpen = false">Cancel</button>
          <button type="button" class="yayaw-button" @click="applyBulkEdit">Apply</button>
        </div>
      </div>
    </section>
  </div>
</template>
