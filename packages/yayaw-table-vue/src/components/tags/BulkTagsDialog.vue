<script setup lang="ts">
import { X } from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { computed, ref, useId, watch } from "vue";
import { bulkCompletion } from "../../bulk-form";
import { useTableContext } from "../../context";
import {
  countTagLabel,
  formatTagLabel,
  planTagBulkUpdate,
  selectionTagUsage,
  type TagPatch,
} from "../../tag-catalog";
import type { TableRecord } from "../../types";
import FieldSelect from "../forms/FieldSelect.vue";
import TagPicker from "./TagPicker.vue";

/**
 * Bulk "Add tags" and "Remove tags": pick tags (create them on the fly when
 * adding), then the selection is patched at once and saved through
 * `bulkUpdate` (see `planTagBulkUpdate`), or `update` row by row. Failed rows
 * are restored and stay selected.
 */
const props = defineProps<{
  mode: "add" | "remove" | null;
  /** The selected rows when the dialog opened. */
  rows: TableRecord[];
}>();
const emit = defineEmits<{ close: [] }>();
const context = useTableContext();
const catalog = context.tags;
const prefix = useId();
const columns = computed(
  () => catalog?.columns.filter((column) => column.multiple) ?? []
);
const columnId = ref(columns.value[0]?.columnId ?? "");
const picked = ref<string[]>([]);
const open = computed(() => props.mode !== null && props.rows.length > 0);
watch(open, (value) => {
  if (!value) return;
  picked.value = [];
  if (!columns.value.some((column) => column.columnId === columnId.value)) {
    columnId.value = columns.value[0]?.columnId ?? "";
  }
});
const labels = computed(() => catalog?.labels.value);
const column = computed(() =>
  columns.value.find((item) => item.columnId === columnId.value)
);
const catalogTags = computed(() =>
  column.value && catalog ? catalog.tags(column.value.columnId) : []
);
const usage = computed(() =>
  column.value && props.mode === "remove"
    ? selectionTagUsage(
        props.rows.map((row) => row[column.value?.field ?? ""]),
        catalogTags.value
      )
    : []
);
const counts = computed(() =>
  props.mode === "remove"
    ? Object.fromEntries(usage.value.map(({ tag, count }) => [tag.id, count]))
    : undefined
);
const title = computed(() => {
  if (!labels.value) return "";
  const count = props.rows.length;
  return props.mode === "remove"
    ? countTagLabel(labels.value.removeTitleOne, labels.value.removeTitleMany, count)
    : countTagLabel(labels.value.addTitleOne, labels.value.addTitleMany, count);
});
const createTag = computed(() => {
  const current = column.value;
  if (!(catalog && current && props.mode === "add" && catalog.canCreate(current.columnId))) {
    return undefined;
  }
  return (name: string) => catalog.create(current.columnId, name);
});

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/** Runs a plan; answers the ids that were not saved and the first error. */
const runPlan = async (
  plan: ReturnType<typeof planTagBulkUpdate>,
  field: string,
  rows: TableRecord[]
): Promise<{ failed: string[]; error?: string }> => {
  const actions = context.actions.value;
  const failed: string[] = [];
  let error: string | undefined;
  for (const call of plan.calls) {
    if (actions?.bulkUpdate) {
      try {
        const result = await actions.bulkUpdate(call.ids, call.patch);
        failed.push(...bulkCompletion(call.ids, result ?? { success: false }).remaining);
        if (!result?.success) error ??= result?.error;
      } catch (cause) {
        failed.push(...call.ids);
        error ??= errorText(cause);
      }
      continue;
    }
    // Without bulkUpdate, each row gets its resulting tags through update.
    for (const id of call.ids) {
      try {
        const row = rows.find((item) => context.getRowId(item) === id) ?? {};
        const result = await actions?.update?.(id, { [field]: plan.next[id] }, { row: { ...row } });
        if (!result?.success) {
          failed.push(id);
          error ??= result?.error;
        }
      } catch (cause) {
        failed.push(id);
        error ??= errorText(cause);
      }
    }
  }
  return { failed, error };
};

const apply = (): void => {
  const current = column.value;
  const mode = props.mode;
  const words = labels.value;
  if (!(current && mode && words && picked.value.length)) return;
  const rows = [...props.rows];
  const patch: TagPatch = mode === "add" ? { add: picked.value } : { remove: picked.value };
  const plan = planTagBulkUpdate({
    rows: rows.map((row) => ({ id: context.getRowId(row), value: row[current.field] })),
    field: current.field,
    patch,
    mode: current.bulk,
  });
  // The loaded rows show the result at once; failures restore them.
  const previous = new Map<TableRecord, unknown>();
  for (const row of context.data.rows.value) {
    const next = plan.next[context.getRowId(row)];
    if (next) {
      previous.set(row, row[current.field]);
      row[current.field] = next;
    }
  }
  const restore = () => {
    for (const [row, value] of previous) row[current.field] = value;
  };
  emit("close");
  runPlan(plan, current.field, rows)
    .then(async ({ failed, error }) => {
      const ids = rows.map((row) => context.getRowId(row));
      const completed = new Set(ids.filter((id) => !failed.includes(id)));
      if (failed.length) {
        restore();
        context.status.value = {
          type: "error",
          message: error ?? formatTagLabel(words.bulkFailed, { count: failed.length }),
        };
      } else {
        context.status.value = {
          type: "success",
          message:
            mode === "add"
              ? countTagLabel(words.addedOne, words.addedMany, rows.length)
              : countTagLabel(words.removedOne, words.removedMany, rows.length),
        };
      }
      context.selection.value = Object.fromEntries(
        Object.entries(context.selection.value).filter(
          ([id, value]) => value && !completed.has(id)
        )
      );
      await context.refresh();
    })
    .catch((cause: unknown) => {
      restore();
      context.status.value = { type: "error", message: errorText(cause) };
    });
};
</script>

<template>
  <DialogRoot v-if="catalog && labels" :open="open" @update:open="!$event && emit('close')">
    <DialogPortal>
      <DialogOverlay class="yayaw-tags-overlay" />
      <DialogContent class="yayaw-tags-dialog" :data-bulk-tags="mode ?? undefined">
        <header class="yayaw-tags-dialog-header">
          <DialogTitle as="h2">{{ title }}</DialogTitle>
          <DialogDescription>{{ labels.chooseTags }}</DialogDescription>
        </header>
        <DialogClose class="yayaw-icon-button yayaw-tags-dialog-close" :aria-label="labels.close">
          <X :size="16" aria-hidden="true" />
        </DialogClose>
        <div v-if="columns.length > 1" class="yayaw-tags-field">
          <span :id="`${prefix}-column`" class="yayaw-label">{{ labels.column }}</span>
          <FieldSelect
            :id="`${prefix}-column-select`"
            :model-value="columnId"
            :options="columns.map((item) => ({ value: item.columnId, label: catalog!.columnLabel(item.columnId) }))"
            :placeholder="labels.column"
            :labelled-by="`${prefix}-column`"
            @update:model-value="columnId = String($event); picked = []"
          />
        </div>
        <p v-if="column && mode === 'remove' && !usage.length" class="yayaw-help">{{ labels.noSelectionTags }}</p>
        <TagPicker
          v-else-if="column"
          :key="`${mode}:${column.columnId}`"
          :model-value="picked"
          multiple
          :tags="mode === 'remove' ? usage.map(({ tag }) => tag) : catalogTags"
          :counts="counts"
          :labels="labels"
          :label="labels.chooseTags"
          :colored-tags="catalog.coloredTags(column.columnId)"
          :create="createTag"
          @update:model-value="picked = $event as string[]"
        />
        <div class="yayaw-tags-actions">
          <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('close')">{{ labels.cancel }}</button>
          <button
            type="button"
            class="yayaw-button"
            :class="{ 'yayaw-button-danger': mode === 'remove' }"
            :disabled="!picked.length"
            @click="apply"
          >
            {{ mode === "remove" ? labels.remove : labels.add }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
