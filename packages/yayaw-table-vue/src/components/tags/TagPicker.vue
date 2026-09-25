<script setup lang="ts">
import { Check, LoaderCircle, Plus, X } from "lucide-vue-next";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
} from "reka-ui";
import { computed, nextTick, onMounted, ref, useTemplateRef } from "vue";
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import {
  cleanTagName,
  filterTags,
  findTagByName,
  formatTagLabel,
  TAG_CREATE_ITEM,
  type TableTag,
  type TagLabels,
  tagCreateName,
  tagIdsOf,
  tagValueOf,
  withTagSelected,
} from "../../tag-catalog";
import { tagAppearance } from "../../tag-colors";
import "../../tag-colors.css";

/**
 * Picks tags from a catalog: colored chips, search by name (without case or
 * accents) and "Create “name”" when nothing has that name. Arrow keys move in
 * the list, Enter picks, Backspace removes the last chip. `cell`: an inline
 * editor, open at once; Enter (with nothing to pick) or leaving commits,
 * Escape cancels. `field`: a form control that opens on demand.
 */
const props = withDefaults(
  defineProps<{
    tags: readonly TableTag[];
    /** Tag ids: a list, or one id when `multiple` is false. */
    modelValue: unknown;
    multiple: boolean;
    labels: TagLabels;
    /** Accessible name of the input. */
    label: string;
    coloredTags?: boolean;
    disabled?: boolean;
    mode?: "cell" | "field";
    /** Creates a tag from what was typed; none without it. */
    create?: (name: string) => Promise<TableTag>;
    /** Numbers shown next to tags (records using them). */
    counts?: Readonly<Record<string, number>>;
    id?: string;
    invalid?: boolean;
    describedBy?: string;
    placeholder?: string;
  }>(),
  { coloredTags: true, mode: "field" }
);
const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  commit: [];
  cancel: [];
}>();

const NAVIGATION_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const query = ref("");
const open = ref(props.mode === "cell");
const creating = ref<string>();
const error = ref<string>();
let navigated = false;
let latestValue: unknown = props.modelValue;
let pendingCreate: Promise<void> | undefined;

const selected = computed(() => tagIdsOf(props.modelValue));
const byId = computed(() => new Map(props.tags.map((tag) => [tag.id, tag])));
const tagOf = (id: string): TableTag =>
  byId.value.get(id) ?? { id, name: id };
const createName = computed(() =>
  props.create && !creating.value
    ? tagCreateName(query.value, props.tags)
    : undefined
);
const items = computed(() => {
  const found = filterTags(props.tags, query.value).map((tag) => tag.id);
  return createName.value ? [...found, TAG_CREATE_ITEM] : found;
});
const createLabel = computed(() =>
  formatTagLabel(props.labels.create, { name: cleanTagName(query.value) })
);
const chip = (id: string) => {
  const appearance = tagAppearance(
    id,
    props.coloredTags,
    undefined,
    tagOf(id).color
  );
  return {
    class: ["yayaw-tag", appearance.className],
    style: appearance.style,
    "data-colored": String(appearance.colored),
    "data-custom-color": appearance.className ? "" : undefined,
  };
};

const change = (value: unknown): void => {
  latestValue = value;
  emit("update:modelValue", value);
};
const finish = async (): Promise<void> => {
  await pendingCreate;
  emit("commit");
};
const createFromQuery = (): void => {
  const name = tagCreateName(query.value, props.tags);
  const run = props.create;
  if (!(name && run) || pendingCreate) return;
  creating.value = name;
  error.value = undefined;
  pendingCreate = run(name)
    .then((tag) => {
      change(withTagSelected(latestValue, tag.id, props.multiple));
      query.value = "";
      if (!props.multiple && props.mode === "cell") emit("commit");
    })
    .catch((cause: unknown) => {
      error.value = cause instanceof Error ? cause.message : String(cause);
    })
    .finally(() => {
      creating.value = undefined;
      pendingCreate = undefined;
    });
};
const pick = (id: string): void => {
  if (props.multiple) {
    change(withTagSelected(selected.value, id, true));
  } else {
    change(id);
    if (props.mode === "cell") void finish();
  }
  query.value = "";
};
const update = (value: unknown): void => {
  navigated = false;
  const ids = (Array.isArray(value) ? value : [value]).map(String);
  if (ids.includes(TAG_CREATE_ITEM)) {
    createFromQuery();
    return;
  }
  error.value = undefined;
  query.value = "";
  if (props.multiple) {
    change(tagValueOf(ids, true));
    return;
  }
  const added = ids.find((id) => !selected.value.includes(id));
  change(tagValueOf(added ? [added] : [], false));
  if (added && props.mode === "cell") void finish();
};
const remove = (id: string): void => {
  if (props.disabled) return;
  change(
    tagValueOf(
      selected.value.filter((item) => item !== id),
      props.multiple
    )
  );
  void nextTick(() => anchor.value?.querySelector("input")?.focus());
};
const setOpen = (value: boolean): void => {
  updateOpen(value);
  if (value) {
    open.value = true;
    return;
  }
  // Leaving the cell editor saves it; a field only closes its list.
  if (props.mode === "cell") {
    void finish();
    return;
  }
  open.value = false;
};
/** Captured before Reka: Enter picks only after typing or moving in the list. */
const onKeydownCapture = (event: KeyboardEvent): void => {
  if (event.isComposing) return;
  const input = event.target as HTMLElement;
  if (NAVIGATION_KEYS.has(event.key)) {
    navigated = true;
    return;
  }
  if (event.key === "Escape" && props.mode === "cell") {
    event.preventDefault();
    event.stopPropagation();
    emit("cancel");
    return;
  }
  if (event.key === "Backspace" && !query.value && selected.value.length) {
    event.preventDefault();
    const last = selected.value.at(-1);
    if (last) remove(last);
    return;
  }
  if (event.key !== "Enter" || input.tagName !== "INPUT") return;
  const typed = query.value.trim() !== "";
  if (input.getAttribute("aria-activedescendant") && (typed || navigated))
    return;
  event.preventDefault();
  event.stopPropagation();
  if (typed) {
    const existing = findTagByName(props.tags, query.value);
    if (existing) pick(existing.id);
    else createFromQuery();
    return;
  }
  if (props.mode === "cell") void finish();
  else open.value = false;
};
const onEscape = (event: KeyboardEvent): void => {
  if (props.mode !== "cell") return;
  event.preventDefault();
  emit("cancel");
};
const typing = (): void => {
  navigated = false;
};
onMounted(async () => {
  if (props.mode !== "cell") return;
  await nextTick();
  updateOpen(true);
  anchor.value?.querySelector("input")?.focus();
});
</script>

<template>
  <div
    ref="anchor"
    class="yayaw-tag-picker"
    data-tag-picker=""
    :data-mode="mode"
    @keydown.capture="onKeydownCapture"
  >
    <ComboboxRoot
      multiple
      ignore-filter
      open-on-click
      :open="open"
      :model-value="selected"
      :disabled="disabled"
      :reset-search-term-on-select="false"
      :reset-search-term-on-blur="mode !== 'cell'"
      @update:model-value="update"
      @update:open="setOpen"
    >
      <ComboboxAnchor as-child>
        <div class="yayaw-inline-editor yayaw-inline-selection yayaw-tag-picker-control" :data-invalid="invalid || undefined">
          <div class="yayaw-inline-chips">
            <span v-for="id in selected" :key="id" v-bind="chip(id)" class="yayaw-inline-chip" :data-tag-id="id">
              {{ tagOf(id).name }}
              <button
                v-if="!disabled"
                type="button"
                :aria-label="formatTagLabel(labels.removeTag, { name: tagOf(id).name })"
                @click.stop="remove(id)"
              >
                <X :size="12" aria-hidden="true" />
              </button>
            </span>
          </div>
          <ComboboxInput
            :id="id"
            v-model="query"
            class="yayaw-inline-search"
            :aria-label="label"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            :placeholder="selected.length ? undefined : (placeholder ?? (props.create ? labels.search : labels.searchOnly))"
            autocomplete="off"
            @input="typing"
          />
        </div>
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent
          class="yayaw-inline-options yayaw-tag-options"
          position="popper"
          align="start"
          :side-offset="6"
          :collision-padding="8"
          :style="overlayStyle"
          :aria-label="label"
          @escape-key-down="onEscape"
        >
          <div v-if="creating || error" class="yayaw-tag-status">
            <output v-if="creating" class="yayaw-help">
              <LoaderCircle :size="14" class="yayaw-spin" aria-hidden="true" />
              {{ labels.creating }}
            </output>
            <p v-if="error" class="yayaw-field-error" role="alert">{{ error }}</p>
          </div>
          <div v-if="!items.length" class="yayaw-inline-empty">
            {{ tags.length ? labels.noMatch : labels.noTags }}
          </div>
          <ComboboxItem
            v-for="item in items"
            :key="item"
            :value="item"
            :text-value="item === TAG_CREATE_ITEM ? createLabel : tagOf(item).name"
            :disabled="item === TAG_CREATE_ITEM && Boolean(creating)"
            class="yayaw-inline-option yayaw-tag-option"
            :data-tag-create="item === TAG_CREATE_ITEM ? '' : undefined"
          >
            <template v-if="item === TAG_CREATE_ITEM">
              <Plus :size="16" aria-hidden="true" />
              <span>{{ createLabel }}</span>
            </template>
            <template v-else>
              <span v-bind="chip(item)" class="yayaw-tag-chip">{{ tagOf(item).name }}</span>
              <span v-if="counts?.[item] !== undefined" class="yayaw-tag-count">{{ counts[item] }}</span>
            </template>
            <ComboboxItemIndicator class="yayaw-inline-check"><Check :size="16" aria-hidden="true" /></ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
    <p v-if="mode === 'field' && !open && error" class="yayaw-field-error" role="alert">{{ error }}</p>
  </div>
</template>
