<script setup lang="ts">
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-vue-next";
import {
  computed,
  type CSSProperties,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { useTableContext } from "../../context";
import type { TableRecord } from "../../types";

const props = defineProps<{ row: TableRecord }>();
const context = useTableContext();
const trigger = ref<HTMLElement>();
const menuOpen = ref(false);
const pending = ref<string>();
const confirmingDelete = ref(false);
const menuPosition = ref({ right: 0, top: 0 });

const canEdit = computed(
  () =>
    context.config.table.allowEdit &&
    Boolean(context.actions.value?.update) &&
    context.config.table.canEditRow?.(props.row) !== false
);
const canDuplicate = computed(
  () =>
    context.config.table.allowDuplicate &&
    Boolean(context.actions.value?.duplicate) &&
    context.config.table.canDuplicateRow?.(props.row) !== false
);
const canDelete = computed(
  () =>
    context.config.table.allowDelete &&
    Boolean(context.actions.value?.delete) &&
    context.config.table.canDeleteRow?.(props.row) !== false
);
const hasActions = computed(
  () => canEdit.value || canDuplicate.value || canDelete.value
);
const menuStyle = computed<CSSProperties>(() => ({
  right: `${menuPosition.value.right}px`,
  top: `${menuPosition.value.top}px`,
}));
const translate = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);

const closeMenu = (): void => {
  menuOpen.value = false;
};
const toggleMenu = (): void => {
  if (menuOpen.value) {
    closeMenu();
    return;
  }
  const bounds = trigger.value?.getBoundingClientRect();
  if (bounds) {
    menuPosition.value = {
      right: Math.max(8, window.innerWidth - bounds.right),
      top: bounds.bottom + 4,
    };
  }
  menuOpen.value = true;
};
const handleDocumentPointer = (event: PointerEvent): void => {
  const target = event.target as Element;
  if (!trigger.value?.contains(target) && !target.closest(".yayaw-row-actions-menu")) {
    closeMenu();
  }
};
const handleDocumentKey = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    closeMenu();
  }
};
onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointer);
  document.addEventListener("keydown", handleDocumentKey);
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointer);
  document.removeEventListener("keydown", handleDocumentKey);
  window.removeEventListener("resize", closeMenu);
  window.removeEventListener("scroll", closeMenu, true);
});

const run = async (kind: "delete" | "duplicate" | "edit"): Promise<void> => {
  closeMenu();
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
  closeMenu();
  confirmingDelete.value = true;
};
const confirmDelete = async (): Promise<void> => {
  confirmingDelete.value = false;
  await run("delete");
};
</script>

<template>
  <div v-if="hasActions" class="yayaw-row-actions" @click.stop>
    <button
      ref="trigger"
      type="button"
      class="yayaw-icon-button"
      :disabled="Boolean(pending)"
      :aria-label="translate('openActions', 'Open actions menu')"
      :title="translate('actions', 'Actions')"
      :aria-expanded="menuOpen"
      aria-haspopup="menu"
      @click="toggleMenu"
    >
      <MoreHorizontal :size="17" aria-hidden="true" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="menuOpen"
      class="yayaw-row-actions-menu"
      role="menu"
      :aria-label="translate('actions', 'Actions')"
      :style="menuStyle"
      @click.stop
    >
      <button
        v-if="canEdit"
        type="button"
        class="yayaw-row-action-item"
        role="menuitem"
        @click="run('edit')"
      >
        <Pencil :size="15" aria-hidden="true" />
        {{ translate("edit", "Edit") }}
      </button>
      <button
        v-if="canDuplicate"
        type="button"
        class="yayaw-row-action-item"
        role="menuitem"
        @click="run('duplicate')"
      >
        <Copy :size="15" aria-hidden="true" />
        {{ translate("duplicate", "Duplicate") }}
      </button>
      <button
        v-if="canDelete"
        type="button"
        class="yayaw-row-action-item yayaw-row-action-danger"
        role="menuitem"
        @click="requestDelete"
      >
        <Trash2 :size="15" aria-hidden="true" />
        {{ translate("delete", "Delete") }}
      </button>
    </div>

    <div
      v-if="confirmingDelete"
      class="yayaw-dialog-backdrop"
      @mousedown.self="confirmingDelete = false"
      @click.stop
    >
      <section
        class="yayaw-form-surface yayaw-confirm-surface"
        data-presentation="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete row"
      >
        <header class="yayaw-form-header">
          <div>
            <h3>Delete row?</h3>
            <p>This action cannot be undone.</p>
          </div>
        </header>
        <div class="yayaw-confirm-body">
          <button
            type="button"
            class="yayaw-button yayaw-button-outline"
            @click="confirmingDelete = false"
          >
            {{ translate("cancel", "Cancel") }}
          </button>
          <button
            type="button"
            class="yayaw-button yayaw-button-danger"
            @click="confirmDelete"
          >
            {{ translate("delete", "Delete") }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
