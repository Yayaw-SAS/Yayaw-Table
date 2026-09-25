<script setup lang="ts">
import { Check, MoreHorizontal, Search, X } from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed, nextTick, ref, useId, watch } from "vue";
import type { TagCatalogRuntime } from "../../composables/use-tag-catalogs";
import { useTableContext } from "../../context";
import {
  cleanTagName,
  countTagLabel,
  filterTags,
  findTagByName,
  formatTagLabel,
  type TableTag,
  type TagLabels,
} from "../../tag-catalog";
import { TAG_COLOR_NAMES, type TagColorName, tagSwatchColor } from "../../tag-colors";
import FieldSelect from "../forms/FieldSelect.vue";

/**
 * "Manage tags" of a tags column: rename, recolor, merge into another tag
 * and delete (confirmed with the number of records that use the tag, counted
 * with `aggregate`).
 */
const props = defineProps<{ open: boolean; columnId: string }>();
const emit = defineEmits<{ "update:open": [open: boolean] }>();
const context = useTableContext();
const catalog = context.tags as TagCatalogRuntime;
const prefix = useId();

type Confirmation =
  | { kind: "delete"; id: string }
  | { kind: "merge"; id: string; targetId?: string };

const COLOR_LABEL_KEYS: Record<TagColorName, keyof TagLabels> = {
  gray: "colorGray",
  brown: "colorBrown",
  orange: "colorOrange",
  yellow: "colorYellow",
  green: "colorGreen",
  blue: "colorBlue",
  purple: "colorPurple",
  pink: "colorPink",
  red: "colorRed",
};

const labels = computed(() => catalog.labels.value);
const tags = computed(() => catalog.tags(props.columnId));
const coloredTags = computed(() => catalog.coloredTags(props.columnId));
const query = ref("");
const counts = ref<Record<string, number>>();
const counting = ref(false);
const confirmation = ref<Confirmation | null>(null);
const busy = ref(false);
const error = ref<string>();
const drafts = ref<Record<string, string>>({});
const nameErrors = ref<Record<string, string | undefined>>({});
const visible = computed(() => filterTags(tags.value, query.value));
const canUpdate = computed(() => catalog.canUpdate(props.columnId));
const canMerge = computed(() => catalog.canMerge(props.columnId) && tags.value.length > 1);
const canRemove = computed(() => catalog.canRemove(props.columnId));

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);
const loadCounts = async (): Promise<void> => {
  if (!catalog.canCount()) return;
  counting.value = true;
  try {
    counts.value = await catalog.usage(props.columnId);
  } catch {
    counts.value = undefined;
  } finally {
    counting.value = false;
  }
};
watch(
  () => props.open,
  (value) => {
    if (!value) return;
    query.value = "";
    confirmation.value = null;
    error.value = undefined;
    drafts.value = {};
    nameErrors.value = {};
    void loadCounts();
  },
  { immediate: true }
);

const usageText = (id: string): string | undefined => {
  if (!counts.value) return;
  const count = counts.value[id] ?? 0;
  return count === 0
    ? labels.value.usageNone
    : countTagLabel(labels.value.usageOne, labels.value.usageMany, count);
};
const swatch = (tag: TableTag, color = tag.color) => {
  const value = tagSwatchColor(tag.id, coloredTags.value, color);
  return value ? { "--yayaw-tag-color": value } : undefined;
};
const notify = (message: string): void => {
  context.status.value = { type: "success", message };
};
const run = async (work: () => Promise<void>, done: string): Promise<void> => {
  busy.value = true;
  error.value = undefined;
  try {
    await work();
    notify(done);
    confirmation.value = null;
    void loadCounts();
  } catch (cause) {
    error.value = errorText(cause);
  } finally {
    busy.value = false;
  }
};
const draftOf = (tag: TableTag): string => drafts.value[tag.id] ?? tag.name;
const rename = async (tag: TableTag): Promise<void> => {
  const name = cleanTagName(draftOf(tag));
  if (name === tag.name) {
    delete drafts.value[tag.id];
    nameErrors.value[tag.id] = undefined;
    return;
  }
  if (!name) {
    nameErrors.value[tag.id] = labels.value.emptyName;
    return;
  }
  const other = findTagByName(
    tags.value.filter((item) => item.id !== tag.id),
    name
  );
  if (other) {
    nameErrors.value[tag.id] = formatTagLabel(labels.value.duplicateName, { name: other.name });
    return;
  }
  nameErrors.value[tag.id] = undefined;
  try {
    await catalog.update(props.columnId, tag.id, { name });
    delete drafts.value[tag.id];
    notify(labels.value.saved);
  } catch (cause) {
    nameErrors.value[tag.id] = errorText(cause);
  }
};
const resetName = (tag: TableTag): void => {
  delete drafts.value[tag.id];
  nameErrors.value[tag.id] = undefined;
};
const onNameEscape = (event: KeyboardEvent, tag: TableTag): void => {
  if (drafts.value[tag.id] === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  resetName(tag);
};
const recolor = (tag: TableTag, color: string | null): void => {
  void run(() => catalog.update(props.columnId, tag.id, { color }), labels.value.saved);
};
const cancelButton = ref<HTMLButtonElement>();
const ask = async (next: Confirmation): Promise<void> => {
  confirmation.value = next;
  await nextTick();
  cancelButton.value?.focus();
};
const confirmTag = computed(() =>
  tags.value.find((tag) => tag.id === confirmation.value?.id)
);
const mergeTarget = computed(() => {
  const current = confirmation.value;
  return current?.kind === "merge"
    ? tags.value.find((tag) => tag.id === current.targetId)
    : undefined;
});
const confirmDescription = computed(() => {
  const current = confirmation.value;
  const tag = confirmTag.value;
  if (!(current && tag)) return;
  if (current.kind === "merge") {
    return mergeTarget.value
      ? formatTagLabel(labels.value.mergeDescription, { source: tag.name, target: mergeTarget.value.name })
      : undefined;
  }
  const count = counts.value?.[tag.id] ?? (counts.value ? 0 : undefined);
  if (count === undefined) return counting.value ? labels.value.counting : labels.value.deleteUnknown;
  if (count === 0) return labels.value.deleteUnused;
  return countTagLabel(labels.value.deleteUsedOne, labels.value.deleteUsedMany, count);
});
const confirm = (): void => {
  const current = confirmation.value;
  if (!current) return;
  if (current.kind === "merge") {
    const targetId = current.targetId;
    if (targetId) void run(() => catalog.merge(props.columnId, [current.id], targetId), labels.value.merged);
    return;
  }
  void run(() => catalog.remove(props.columnId, current.id), labels.value.deleted);
};
const setTarget = (value: unknown): void => {
  if (confirmation.value?.kind === "merge") {
    confirmation.value = { ...confirmation.value, targetId: String(value) };
  }
};
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="yayaw-tags-overlay" />
      <DialogContent class="yayaw-tags-dialog yayaw-tags-manage" :data-manage-tags="columnId">
        <header class="yayaw-tags-dialog-header">
          <DialogTitle as="h2">{{ labels.manageTags }}</DialogTitle>
          <DialogDescription>{{ formatTagLabel(labels.manageDescription, { column: catalog.columnLabel(columnId) }) }}</DialogDescription>
        </header>
        <DialogClose class="yayaw-icon-button yayaw-tags-dialog-close" :aria-label="labels.close">
          <X :size="16" aria-hidden="true" />
        </DialogClose>
        <p v-if="error" class="yayaw-field-error" role="alert">{{ error }}</p>
        <section
          v-if="confirmation && confirmTag"
          class="yayaw-tags-confirm"
          :aria-labelledby="`${prefix}-confirm`"
          :data-tags-confirm="confirmation.kind"
        >
          <h3 :id="`${prefix}-confirm`">
            {{ confirmation.kind === "merge"
              ? formatTagLabel(labels.mergeInto, { name: confirmTag.name })
              : formatTagLabel(labels.deleteTitle, { name: confirmTag.name }) }}
          </h3>
          <FieldSelect
            v-if="confirmation.kind === 'merge'"
            :id="`${prefix}-target`"
            :model-value="confirmation.targetId"
            :options="tags.filter((tag) => tag.id !== confirmTag!.id).map((tag) => ({ value: tag.id, label: tag.name }))"
            :placeholder="labels.searchOnly"
            :labelled-by="`${prefix}-confirm`"
            @update:model-value="setTarget"
          />
          <p v-if="confirmDescription">{{ confirmDescription }}</p>
          <div class="yayaw-tags-actions">
            <button ref="cancelButton" type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" @click="confirmation = null">{{ labels.cancel }}</button>
            <button
              type="button"
              class="yayaw-button yayaw-button-danger"
              :disabled="busy || (confirmation.kind === 'merge' && !mergeTarget)"
              @click="confirm"
            >
              {{ confirmation.kind === "merge" ? labels.mergeConfirm : labels.delete }}
            </button>
          </div>
        </section>
        <div v-else class="yayaw-tags-manage-body">
          <label class="yayaw-tags-search">
            <Search :size="16" aria-hidden="true" />
            <input v-model="query" type="search" class="yayaw-input" :aria-label="labels.searchOnly" :placeholder="labels.searchOnly" />
          </label>
          <p v-if="catalog.status(columnId) === 'error'" class="yayaw-field-error" role="alert">
            {{ labels.loadError }}
            <button type="button" class="yayaw-button yayaw-button-outline" @click="catalog.reload(columnId)">{{ labels.retry }}</button>
          </p>
          <output v-else-if="catalog.status(columnId) === 'loading'" class="yayaw-help">{{ labels.loading }}</output>
          <p v-else-if="!tags.length" class="yayaw-help">{{ labels.noTags }}</p>
          <p v-else-if="!visible.length" class="yayaw-help">{{ labels.noMatch }}</p>
          <ul class="yayaw-tags-list" :aria-label="labels.tags">
            <li v-for="tag in visible" :key="tag.id" class="yayaw-tags-row" :data-tag-row="tag.id">
              <DropdownMenuRoot v-if="canUpdate && coloredTags" :modal="false">
                <DropdownMenuTrigger class="yayaw-icon-button" :aria-label="formatTagLabel(labels.colorOf, { name: tag.name })">
                  <span class="yayaw-tag-swatch" :style="swatch(tag)" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent class="yayaw-column-menu" align="start" :side-offset="4">
                    <DropdownMenuItem class="yayaw-column-menu-item" @select="recolor(tag, null)">
                      <span class="yayaw-tag-swatch" :style="swatch(tag, undefined)" aria-hidden="true" />
                      <span class="yayaw-tags-menu-label">{{ labels.defaultColor }}</span>
                      <Check v-if="!tag.color" :size="16" aria-hidden="true" />
                    </DropdownMenuItem>
                    <DropdownMenuItem v-for="color in TAG_COLOR_NAMES" :key="color" class="yayaw-column-menu-item" @select="recolor(tag, color)">
                      <span class="yayaw-tag-swatch" :style="swatch(tag, color)" aria-hidden="true" />
                      <span class="yayaw-tags-menu-label">{{ labels[COLOR_LABEL_KEYS[color]] }}</span>
                      <Check v-if="tag.color === color" :size="16" aria-hidden="true" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
              <div v-if="canUpdate" class="yayaw-tags-name">
                <input
                  class="yayaw-input"
                  :value="draftOf(tag)"
                  :disabled="busy"
                  :aria-label="formatTagLabel(labels.renameTag, { name: tag.name })"
                  :aria-invalid="nameErrors[tag.id] ? true : undefined"
                  :aria-describedby="nameErrors[tag.id] ? `${prefix}-${tag.id}-error` : undefined"
                  @input="drafts[tag.id] = ($event.target as HTMLInputElement).value"
                  @keydown.enter.prevent="rename(tag)"
                  @keydown.esc="onNameEscape($event, tag)"
                  @blur="rename(tag)"
                />
                <p v-if="nameErrors[tag.id]" :id="`${prefix}-${tag.id}-error`" class="yayaw-field-error" role="alert">{{ nameErrors[tag.id] }}</p>
              </div>
              <span v-else class="yayaw-tags-name">
                <span class="yayaw-tag yayaw-tag-chip" :data-colored="String(coloredTags)">{{ tag.name }}</span>
              </span>
              <span class="yayaw-tags-usage">{{ usageText(tag.id) }}</span>
              <DropdownMenuRoot v-if="canMerge || canRemove" :modal="false">
                <DropdownMenuTrigger class="yayaw-icon-button" :disabled="busy" :aria-label="formatTagLabel(labels.tagActions, { name: tag.name })">
                  <MoreHorizontal :size="16" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent class="yayaw-column-menu" align="end" :side-offset="4">
                    <DropdownMenuItem v-if="canMerge" class="yayaw-column-menu-item" @select="ask({ kind: 'merge', id: tag.id })">{{ labels.merge }}</DropdownMenuItem>
                    <DropdownMenuItem v-if="canRemove" class="yayaw-column-menu-item yayaw-danger-text" @select="ask({ kind: 'delete', id: tag.id })">{{ labels.delete }}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </li>
          </ul>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
