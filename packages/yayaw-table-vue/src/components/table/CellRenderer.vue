<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  type PropType,
  ref,
  type VNodeChild,
} from "vue";
import { useTableContext } from "../../context";
import { displayCellValue, safeHttpUrl } from "../../core";
import type {
  ColumnDefinition,
  ColumnType,
  InlineEditColumnConfig,
  InlineEditEditor,
  SelectOption,
  TableRecord,
} from "../../types";

const props = defineProps<{
  value: unknown;
  row: TableRecord;
  column: ColumnDefinition;
}>();
const context = useTableContext();
const editing = ref(false);
const pending = ref(false);
const draft = ref<unknown>(props.value);
const error = ref<string>();
const columnTypes = new Set<ColumnType>([
  "boolean",
  "code",
  "custom",
  "date",
  "image",
  "json",
  "multiSelect",
  "number",
  "select",
  "string",
  "tag",
  "text",
  "url",
]);
const dynamicType = computed<ColumnType>(() => {
  if (props.column.type !== "dynamicType") {
    return props.column.type ?? "text";
  }
  const candidate = String(
    props.row[props.column.typeKey ?? "type"] ?? "text"
  ) as ColumnType;
  return columnTypes.has(candidate) ? candidate : "text";
});
const effectiveColumn = computed<ColumnDefinition>(() => ({
  ...props.column,
  type: dynamicType.value,
}));
const customNode = computed(
  () =>
    props.column.cellRenderer?.(props.value, props.row) ??
    props.column.customRenderers?.[dynamicType.value]?.(props.value, props.row)
);
const VNodeRenderer = defineComponent({
  props: {
    node: { type: null as unknown as PropType<VNodeChild>, required: true },
  },
  setup: (rendererProps) => () =>
    h("span", { class: "yayaw-custom-cell" }, [rendererProps.node]),
});

const inlineConfig = computed<InlineEditColumnConfig>(() =>
  typeof props.column.inlineEdit === "object"
    ? props.column.inlineEdit
    : { enabled: props.column.inlineEdit }
);
const canEdit = computed(() => {
  if (
    !(
      context.config.table.allowInlineEdit &&
      context.config.table.inlineEdit?.enabled
    )
  ) {
    return false;
  }
  if (inlineConfig.value.readonly) {
    return false;
  }
  if (props.column.inlineEdit === false) {
    return false;
  }
  return inlineConfig.value.enabled ?? true;
});
const editor = computed<InlineEditEditor>(() => {
  if (inlineConfig.value.editor && inlineConfig.value.editor !== "auto") {
    return inlineConfig.value.editor;
  }
  if (dynamicType.value === "boolean") {
    return "boolean";
  }
  if (dynamicType.value === "date") {
    return "date";
  }
  if (dynamicType.value === "json") {
    return "json";
  }
  if (dynamicType.value === "multiSelect") {
    return "multiSelect";
  }
  if (dynamicType.value === "number") {
    return "number";
  }
  if (dynamicType.value === "select") {
    return "select";
  }
  if (dynamicType.value === "url") {
    return "url";
  }
  return "text";
});
const options = computed<SelectOption[]>(
  () => inlineConfig.value.options ?? props.column.options ?? []
);
const begin = (): void => {
  if (!canEdit.value) {
    return;
  }
  draft.value = Array.isArray(props.value) ? [...props.value] : props.value;
  editing.value = true;
  error.value = undefined;
};
const parseDraft = (): unknown => {
  if (editor.value === "number") {
    const parsed = Number(draft.value);
    if (!Number.isFinite(parsed)) {
      throw new Error("Invalid number");
    }
    return parsed;
  }
  if (editor.value === "json") {
    if (typeof draft.value !== "string") {
      return draft.value;
    }
    return JSON.parse(draft.value);
  }
  return draft.value;
};
const save = async (): Promise<void> => {
  if (!editing.value) {
    return;
  }
  const id = context.getRowId(props.row);
  if (!context.actions.value?.update) {
    editing.value = false;
    return;
  }
  try {
    const value = parseDraft();
    const field =
      inlineConfig.value.formField ??
      props.column.accessorKey ??
      props.column.id;
    const previous = props.row[field];
    if (context.config.table.inlineEdit?.optimistic !== false) {
      props.row[field] = value;
    }
    pending.value = true;
    const result = await context.actions.value.update(id, { [field]: value });
    if (!result.success) {
      props.row[field] = previous;
      throw new Error(result.error ?? "Update failed");
    }
    editing.value = false;
    await context.refresh();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    pending.value = false;
  }
};
const cancel = (): void => {
  editing.value = false;
  draft.value = props.value;
  error.value = undefined;
};
const onKeydown = async (event: KeyboardEvent): Promise<void> => {
  if (!editing.value && event.key === "Enter") {
    begin();
  } else if (editing.value && event.key === "Escape") {
    cancel();
  } else if (
    editing.value &&
    event.key === "Enter" &&
    editor.value !== "textarea" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    await save();
  }
};
const updateMulti = (event: Event): void => {
  draft.value = Array.from(
    (event.target as HTMLSelectElement).selectedOptions
  ).map((option) => option.value);
};
const url = computed(() => safeHttpUrl(props.value));
const imageUrl = computed(() =>
  dynamicType.value === "image" ? safeHttpUrl(props.value) : undefined
);
const tags = computed(() =>
  Array.isArray(props.value) ? props.value : [props.value]
);
</script>

<template>
  <div class="yayaw-cell" :class="{ 'is-editable': canEdit, 'is-pending': pending }" tabindex="0" @dblclick="begin" @keydown="onKeydown">
    <template v-if="editing">
      <input v-if="editor === 'boolean'" v-model="draft" type="checkbox" class="yayaw-checkbox" @change="save" />
      <select v-else-if="editor === 'select'" v-model="draft" class="yayaw-select yayaw-inline-editor" autofocus @change="save" @blur="save">
        <option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
      </select>
      <select v-else-if="editor === 'multiSelect'" multiple class="yayaw-select yayaw-inline-editor" autofocus @change="updateMulti" @blur="save">
        <option v-for="option in options" :key="String(option.value)" :value="option.value" :selected="Array.isArray(draft) && draft.map(String).includes(String(option.value))">{{ option.label }}</option>
      </select>
      <textarea v-else-if="editor === 'textarea' || editor === 'json'" v-model="draft as string" class="yayaw-textarea yayaw-inline-editor" autofocus @blur="save" />
      <input v-else v-model="draft" :type="editor === 'number' ? 'number' : editor === 'date' ? 'date' : editor === 'url' ? 'url' : 'text'" class="yayaw-input yayaw-inline-editor" autofocus @blur="save" />
      <span v-if="error" class="yayaw-inline-error" role="alert">{{ error }}</span>
    </template>
    <VNodeRenderer v-else-if="customNode" :node="customNode" />
    <span v-else-if="effectiveColumn.type === 'boolean'" class="yayaw-boolean" :data-value="Boolean(value)" role="img" :aria-label="value ? 'True' : 'False'"><span aria-hidden="true">{{ value ? '✓' : '—' }}</span></span>
    <code v-else-if="effectiveColumn.type === 'code'" class="yayaw-code">{{ displayCellValue(value, effectiveColumn) }}</code>
    <img v-else-if="imageUrl" :src="imageUrl" :alt="column.header" class="yayaw-cell-image" loading="lazy" />
    <a v-else-if="effectiveColumn.type === 'url' && url" :href="url" target="_blank" rel="noopener noreferrer" class="yayaw-link" @click.stop>
      <template v-if="effectiveColumn.urlDisplayMode === 'icon'">↗</template>
      <template v-else-if="effectiveColumn.urlDisplayMode === 'domain'">{{ new URL(url).hostname }}</template>
      <template v-else>{{ url }}</template>
    </a>
    <span v-else-if="effectiveColumn.type === 'select' || effectiveColumn.type === 'multiSelect' || effectiveColumn.type === 'tag' || effectiveColumn.displayVariant === 'tag'" class="yayaw-tags">
      <span v-for="tag in tags.filter((item) => item !== null && item !== undefined && item !== '')" :key="String(tag)" class="yayaw-tag" :class="effectiveColumn.tagColorMap?.[String(tag)]">{{ tag }}</span>
    </span>
    <pre v-else-if="effectiveColumn.type === 'json'" class="yayaw-json">{{ displayCellValue(value, effectiveColumn) }}</pre>
    <span v-else :class="{ 'yayaw-number': effectiveColumn.type === 'number' }">{{ displayCellValue(value, effectiveColumn) }}</span>
    <span v-if="pending && context.config.table.inlineEdit?.showDelayIndicator" class="yayaw-saving" aria-label="Saving" />
  </div>
</template>
