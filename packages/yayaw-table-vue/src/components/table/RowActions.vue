<script setup lang="ts">
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import type { TableRecord } from "../../types";
import FormDialog from "../forms/FormDialog.vue";

const props = defineProps<{ row: TableRecord }>();
const context = useTableContext();
const root = ref<HTMLElement>();
const trigger = ref<HTMLElement>();
const menuOpen = ref(false);
const pending = ref<string>();
const confirmingDelete = ref(false);
const deleteError = ref("");
const menuTheme = ref<Record<string, string>>({});

const includeEdit = computed(
  () => context.config.table.allowEdit && Boolean(context.actions.value?.update)
);
const includeDuplicate = computed(
  () =>
    context.config.table.allowDuplicate &&
    Boolean(context.actions.value?.duplicate)
);
const includeDelete = computed(
  () =>
    context.config.table.allowDelete && Boolean(context.actions.value?.delete)
);
const canEdit = computed(
  () =>
    includeEdit.value && context.config.table.canEditRow?.(props.row) !== false
);
const canDuplicate = computed(
  () =>
    includeDuplicate.value &&
    context.config.table.canDuplicateRow?.(props.row) !== false
);
const canDelete = computed(
  () =>
    includeDelete.value &&
    context.config.table.canDeleteRow?.(props.row) !== false
);
const hasActions = computed(
  () => includeEdit.value || includeDuplicate.value || includeDelete.value
);
const translate = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);
const menuChanged = (open: boolean): void => {
  menuOpen.value = open;
  if (!open || !root.value) return;
  const style = getComputedStyle(root.value);
  menuTheme.value = Object.fromEntries(
    [
      "background",
      "foreground",
      "muted",
      "muted-foreground",
      "border",
      "primary",
      "primary-foreground",
      "danger",
      "radius",
      "shadow",
    ].map((token) => [
      `--yayaw-${token}`,
      style.getPropertyValue(`--yayaw-${token}`),
    ])
  );
};
const run = async (kind: "delete" | "duplicate" | "edit"): Promise<boolean> => {
  if (pending.value) return false;
  menuOpen.value = false;
  if (kind === "edit") {
    if (!canEdit.value) {
      return false;
    }
    trigger.value?.focus();
    context.openEdit(props.row);
    return true;
  }
  if (
    (kind === "duplicate" && !canDuplicate.value) ||
    (kind === "delete" && !canDelete.value)
  ) {
    return false;
  }
  const id = context.getRowId(props.row);
  pending.value = kind;
  try {
    const action =
      kind === "delete"
        ? context.actions.value?.delete
        : context.actions.value?.duplicate;
    if (!action) {
      return false;
    }
    const result = await action(id);
    if (!result.success) {
      throw new Error(result.error ?? `${kind} failed`);
    }
    context.status.value = {
      type: "success",
      message:
        kind === "delete"
          ? translate("rowDeleted", "Row deleted")
          : translate("rowDuplicated", "Row duplicated"),
    };
    await context.refresh();
    return true;
  } catch (cause) {
    if (kind === "delete")
      deleteError.value =
        cause instanceof Error ? cause.message : String(cause);
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return false;
  } finally {
    pending.value = undefined;
  }
};
const requestDelete = (): void => {
  if (!canDelete.value) {
    return;
  }
  menuOpen.value = false;
  deleteError.value = "";
  confirmingDelete.value = true;
};
const confirmDelete = async (): Promise<void> => {
  deleteError.value = "";
  if (await run("delete")) confirmingDelete.value = false;
};
</script>

<template>
  <div v-if="hasActions" ref="root" class="yayaw-row-actions" @click.stop @keydown.stop>
    <DropdownMenuRoot :open="menuOpen" :modal="false" @update:open="menuChanged">
      <DropdownMenuTrigger as-child>
        <button ref="trigger" type="button" class="yayaw-icon-button" :disabled="Boolean(pending)"
          :aria-label="translate('openActions', 'Open actions menu')" :title="translate('actions', 'Actions')">
          <MoreHorizontal :size="16" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="yayaw-row-actions-menu" :style="menuTheme" align="end" :side-offset="4" :collision-padding="8"
          :aria-label="translate('actions', 'Actions')" @click.stop
          @close-auto-focus="event => { if (confirmingDelete || context.form.value.open) event.preventDefault(); }">
          <DropdownMenuItem v-if="includeEdit" as-child :disabled="!canEdit" @select="run('edit')">
            <button type="button" class="yayaw-row-action-item" :disabled="!canEdit"><Pencil :size="16" aria-hidden="true" />{{ translate("edit", "Edit") }}</button>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="includeDuplicate" as-child :disabled="!canDuplicate" @select="run('duplicate')">
            <button type="button" class="yayaw-row-action-item" :disabled="!canDuplicate"><Copy :size="16" aria-hidden="true" />{{ translate("duplicate", "Duplicate") }}</button>
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="includeDelete && (includeEdit || includeDuplicate)" class="yayaw-row-actions-divider" />
          <DropdownMenuItem v-if="includeDelete" as-child :disabled="!canDelete" @select="requestDelete">
            <button type="button" class="yayaw-row-action-item yayaw-row-action-danger" :disabled="!canDelete"><Trash2 :size="16" aria-hidden="true" />{{ translate("delete", "Delete") }}</button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <FormDialog v-if="confirmingDelete" :open="confirmingDelete" role="alertdialog" presentation="modal" width="min(460px, 94vw)"
      :title="translate('deleteRow', 'Delete row?')" :description="translate('deleteRowDescription', 'This action cannot be undone.')"
      :close-label="translate('close', 'Close')" :return-focus="trigger" :busy="Boolean(pending)" @close="confirmingDelete = false">
      <div class="yayaw-confirm-body">
        <p v-if="deleteError" class="yayaw-error" role="alert">{{ deleteError }}</p>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="Boolean(pending)" @click="confirmingDelete = false">{{ translate("cancel", "Cancel") }}</button>
        <button type="button" class="yayaw-button yayaw-button-danger" :disabled="Boolean(pending)" @click="confirmDelete">{{ translate("delete", "Delete") }}</button>
      </div>
    </FormDialog>
  </div>
</template>
