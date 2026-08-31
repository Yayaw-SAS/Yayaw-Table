<script setup lang="ts">
import { ref } from "vue";
import { useTableContext } from "../../context";
import type { TableRecord } from "../../types";

const props = defineProps<{ row: TableRecord }>();
const context = useTableContext();
const pending = ref<string>();
const confirmingDelete = ref(false);
const run = async (kind: "delete" | "duplicate" | "edit"): Promise<void> => {
  if (kind === "edit") {
    context.openEdit(props.row);
    return;
  }
  const id = context.getRowId(props.row);
  pending.value = kind;
  try {
    const action =
      kind === "delete"
        ? context.actions.value?.delete
        : context.actions.value?.duplicate;
    if (!action) {
      return;
    }
    const result = await action(id);
    if (!result.success) {
      throw new Error(result.error ?? `${kind} failed`);
    }
    context.status.value = {
      type: "success",
      message: kind === "delete" ? "Row deleted" : "Row duplicated",
    };
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
const requestDelete = (): void => {
  confirmingDelete.value = true;
};
const confirmDelete = async (): Promise<void> => {
  confirmingDelete.value = false;
  await run("delete");
};
</script>

<template>
  <div class="yayaw-row-actions" @click.stop>
    <button v-if="context.config.table.allowEdit && context.actions.value?.update && context.config.table.canEditRow?.(row) !== false" type="button" class="yayaw-icon-button" :title="String(context.translations.value.edit)" :aria-label="String(context.translations.value.edit)" @click="run('edit')"><span aria-hidden="true">✎</span></button>
    <button v-if="context.config.table.allowDuplicate && context.actions.value?.duplicate && context.config.table.canDuplicateRow?.(row) !== false" type="button" class="yayaw-icon-button" :disabled="Boolean(pending)" :title="String(context.translations.value.duplicate)" :aria-label="String(context.translations.value.duplicate)" @click="run('duplicate')"><span aria-hidden="true">⧉</span></button>
    <button v-if="context.config.table.allowDelete && context.actions.value?.delete && context.config.table.canDeleteRow?.(row) !== false" type="button" class="yayaw-icon-button yayaw-danger" :disabled="Boolean(pending)" :title="String(context.translations.value.delete)" :aria-label="String(context.translations.value.delete)" @click="requestDelete"><span aria-hidden="true">×</span></button>
  </div>
  <div v-if="confirmingDelete" class="yayaw-dialog-backdrop" @mousedown.self="confirmingDelete = false" @click.stop>
    <section class="yayaw-form-surface yayaw-confirm-surface" data-presentation="modal" role="alertdialog" aria-modal="true" aria-label="Delete row">
      <header class="yayaw-form-header"><div><h3>Delete row?</h3><p>This action cannot be undone.</p></div></header>
      <div class="yayaw-confirm-body">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="confirmingDelete = false">Cancel</button>
        <button type="button" class="yayaw-button yayaw-button-danger" @click="confirmDelete">{{ context.translations.value.delete }}</button>
      </div>
    </section>
  </div>
</template>
