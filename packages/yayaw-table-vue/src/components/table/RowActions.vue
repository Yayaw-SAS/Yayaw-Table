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

const includeEdit = computed(
  () =>
    context.config.table.allowEdit &&
    Boolean(context.actions.value?.update)
);
const includeDuplicate = computed(
  () =>
    context.config.table.allowDuplicate &&
    Boolean(context.actions.value?.duplicate)
);
const includeDelete = computed(
  () =>
    context.config.table.allowDelete &&
    Boolean(context.actions.value?.delete)
);
const canEdit = computed(
  () =>
    includeEdit.value &&
    context.config.table.canEditRow?.(props.row) !== false
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
    const actionCount =
      Number(includeEdit.value) +
      Number(includeDuplicate.value) +
      Number(includeDelete.value);
    const separatorHeight =
      includeDelete.value && (includeEdit.value || includeDuplicate.value)
        ? 9
        : 0;
    const menuHeight = 8 + actionCount * 32 + separatorHeight;
    const opensUpward = bounds.bottom + 4 + menuHeight > window.innerHeight - 8;
    menuPosition.value = {
      right: Math.max(8, window.innerWidth - bounds.right),
      top: Math.max(
        8,
        opensUpward ? bounds.top - menuHeight - 4 : bounds.bottom + 4
      ),
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
    if (!canEdit.value) {
      return;
    }
    context.openEdit(props.row);
    return;
  }
  if (
    (kind === "duplicate" && !canDuplicate.value) ||
    (kind === "delete" && !canDelete.value)
  ) {
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
  if (!canDelete.value) {
    return;
  }
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
      <MoreHorizontal :size="16" aria-hidden="true" />
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
        v-if="includeEdit"
        type="button"
        class="yayaw-row-action-item"
        :disabled="!canEdit"
        role="menuitem"
        @click="run('edit')"
      >
        <Pencil :size="16" aria-hidden="true" />
        {{ translate("edit", "Edit") }}
      </button>
      <button
        v-if="includeDuplicate"
        type="button"
        class="yayaw-row-action-item"
        :disabled="!canDuplicate"
        role="menuitem"
        @click="run('duplicate')"
      >
        <Copy :size="16" aria-hidden="true" />
        {{ translate("duplicate", "Duplicate") }}
      </button>
      <span
        v-if="includeDelete && (includeEdit || includeDuplicate)"
        class="yayaw-row-actions-divider"
        role="separator"
      />
      <button
        v-if="includeDelete"
        type="button"
        class="yayaw-row-action-item yayaw-row-action-danger"
        :disabled="!canDelete"
        role="menuitem"
        @click="requestDelete"
      >
        <Trash2 :size="16" aria-hidden="true" />
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
