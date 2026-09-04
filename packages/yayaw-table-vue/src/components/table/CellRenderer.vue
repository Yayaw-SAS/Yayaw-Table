<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  defineComponent,
  h,
  type PropType,
  ref,
  toRaw,
  watch,
  type VNodeChild,
} from "vue";
import { useTableContext } from "../../context";
import { displayCellValue, safeHttpUrl, imageSource } from "../../core";
import {
  cloneFormValue,
  formValuesEqual,
  fieldIsDisabled,
  fieldIsHidden,
  translateFormConfig,
  validateFormFields,
} from "../../form-runtime";
import type {
  ColumnDefinition,
  ColumnType,
  InlineEditColumnConfig,
  InlineEditEditor,
  FormFieldContext,
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
const fieldName = computed(
  () =>
    inlineConfig.value.formField ?? props.column.accessorKey ?? props.column.id
);
const formContext = computed<FormFieldContext>(() => ({
  mode: "edit",
  row: props.row,
  initialData: props.row,
  values: props.row,
  formType:
    context.config.form?.resolveEditFormType?.(props.row) ??
    context.config.form?.editFormType ??
    context.formType ??
    context.tableType ??
    context.config.id,
  tableId: context.config.id,
  tableType: context.tableType ?? context.config.id,
}));
const formConfig = computed(() => {
  const result = context.getFormConfig?.(
    formContext.value.formType!,
    formContext.value
  );
  return result ? translateFormConfig(result) : undefined;
});
const formField = computed(() =>
  formConfig.value?.fields.find((field) => field.name === fieldName.value)
);
const canEdit = computed(() => {
  if (formConfig.value && !formField.value) return false;
  if (
    formField.value &&
    (fieldIsHidden(formField.value, formContext.value) ||
      fieldIsDisabled(formField.value, formContext.value))
  )
    return false;
  if (
    formField.value &&
    (["collection", "custom"].includes(formField.value.type) ||
      formField.value.searchOptions)
  )
    return false;
  if (
    !(
      context.config.table.allowInlineEdit &&
      (inlineConfig.value.enabled ?? context.config.table.inlineEdit?.enabled) &&
      context.actions.value?.update
    )
  ) {
    return false;
  }
  if (context.config.table.canEditRow?.(props.row) === false) {
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
  const type = formField.value?.type ?? dynamicType.value;
  if (["switch", "checkbox", "boolean"].includes(type)) {
    return "boolean";
  }
  if (type === "date") {
    return "date";
  }
  if (type === "json") {
    return "json";
  }
  if (type === "multiSelect") {
    return "multiSelect";
  }
  if (type === "number") {
    return "number";
  }
  if (["select", "radio", "select-with-add-new"].includes(type)) {
    return "select";
  }
  if (type === "textarea") return "textarea";
  if (type === "url") {
    return "url";
  }
  return "text";
});
const loadedOptions = ref<SelectOption[]>();
const optionsLoading = ref(false);
const optionsFailed = ref(false);
let optionsVersion = 0;
const options = computed<SelectOption[]>(
  () =>
    inlineConfig.value.options ??
    (Array.isArray(formField.value?.options)
      ? formField.value.options
      : undefined) ??
    loadedOptions.value ??
    props.column.options ??
    []
);
const begin = async (): Promise<void> => {
  if (!canEdit.value || pending.value || optionsLoading.value) return;
  draft.value = editor.value === "json" ? JSON.stringify(props.value, null, 2) : cloneFormValue(props.value);
  editing.value = true;
  error.value = undefined;
  loadedOptions.value = undefined;
  optionsFailed.value = false;
  const version = ++optionsVersion;
  const field = formField.value;
  if (typeof field?.options === "function") {
    optionsLoading.value = true;
    try {
      const loaded = await field.options(formContext.value);
      if (version === optionsVersion) loadedOptions.value = loaded;
    } catch (cause) {
      if (version === optionsVersion) {
        optionsFailed.value = true;
        error.value = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (version === optionsVersion) optionsLoading.value = false;
    }
  }
};
const parseDraft = (): unknown => {
  if (editor.value === "number") {
    if (draft.value === "" || draft.value === null) return draft.value;
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
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const save = async (close = true): Promise<void> => {
  clearTimeout(saveTimer);
  if (
    !editing.value ||
    pending.value ||
    optionsLoading.value ||
    optionsFailed.value ||
    !canEdit.value
  )
    return;
  const action = context.actions.value?.update;
  if (!action) return;
  const row = props.row;
  const field = fieldName.value;
  const previous = row[field];
  let optimistic = false;
  let value: unknown;
  pending.value = true;
  error.value = undefined;
  try {
    value = parseDraft();
    if (formValuesEqual(value, props.value)) {
      if (close) editing.value = false;
      return;
    }
    const candidate = { ...cloneFormValue(row), [field]: value };
    if (formField.value) {
      const result = await validateFormFields([formField.value], candidate, {
        ...formContext.value,
        values: candidate,
      });
      const issue = Object.values(result.errors)[0];
      if (issue) throw new Error(issue);
      value = result.values[field];
    }
    if (formConfig.value?.schema) {
      const result = await toRaw(formConfig.value.schema).safeParseAsync({
        ...candidate,
        [field]: value,
      });
      if (!result.success) {
        const issue = result.error.issues.find(
          (issue) => !issue.path.length || issue.path[0] === field
        );
        if (issue) throw new Error(issue.message);
      } else if (
        result.data &&
        typeof result.data === "object" &&
        Object.hasOwn(result.data, field)
      )
        value = (result.data as TableRecord)[field];
    }
    if (row !== props.row || !canEdit.value) return;
    if (context.config.table.inlineEdit?.optimistic !== false) {
      row[field] = value;
      optimistic = true;
    }
    const result = await action(context.getRowId(row), { [field]: value });
    if (!result.success)
      throw new Error(
        result.fieldErrors?.[field] ?? result.error ?? "Update failed"
      );
    optimistic = false;
    if (close) editing.value = false;
    await context.refresh();
  } catch (cause) {
    if (optimistic && Object.is(row[field], value)) row[field] = previous;
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    pending.value = false;
  }
};
watch(draft, () => {
  clearTimeout(saveTimer);
  if (!editing.value || pending.value || Object.is(draft.value, props.value)) return;
  const delay = inlineConfig.value.debounceMs ?? context.config.table.inlineEdit?.debounceMs ?? 700;
  saveTimer = setTimeout(() => { void save(false); }, Math.max(0, delay));
}, { deep: true });
onBeforeUnmount(() => clearTimeout(saveTimer));
const resetEditing = (): void => {
  clearTimeout(saveTimer);
  optionsVersion += 1;
  optionsLoading.value = false;
  editing.value = false;
  draft.value = props.value;
  error.value = undefined;
};
const cancel = (): void => {
  if (!pending.value) resetEditing();
};
watch(() => context.getRowId(props.row), resetEditing);
const onKeydown = async (event: KeyboardEvent): Promise<void> => {
  if (!editing.value && event.key === "Enter") {
    await begin();
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
  ).map((option) => options.value[option.index]?.value ?? option.value);
};
const url = computed(() => safeHttpUrl(props.value));
const urlDomain = computed(() => {
  if (!url.value) {
    return "";
  }
  try {
    return new URL(url.value).hostname;
  } catch {
    return url.value;
  }
});
const imageUrl = computed(() =>
  dynamicType.value === "image" ? imageSource(props.value) : undefined
);
const tags = computed(() =>
  Array.isArray(props.value) ? props.value : [props.value]
);
</script>

<template>
  <div
    class="yayaw-cell"
    :class="{ 'is-editable': canEdit, 'is-pending': pending }"
    tabindex="0"
    @dblclick="begin"
    @keydown="onKeydown"
  >
    <template v-if="editing">
      <input
        v-if="editor === 'boolean'"
        :disabled="pending || optionsLoading"
        :aria-label="formField?.label ?? column.header"
        v-model="draft"
        type="checkbox"
        class="yayaw-checkbox"
        @change="save()"
      />
      <select
        v-else-if="editor === 'select'"
        v-model="draft"
        class="yayaw-select yayaw-inline-editor"
        :disabled="pending || optionsLoading"
        :aria-label="formField?.label ?? column.header"
        autofocus
        @change="save()"
        @blur="save()"
      >
        <option
          v-for="option in options"
          :key="`${typeof option.value}:${option.value}`"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <select
        v-else-if="editor === 'multiSelect'"
        multiple
        :disabled="pending || optionsLoading"
        :aria-label="formField?.label ?? column.header"
        class="yayaw-select yayaw-inline-editor"
        autofocus
        @change="updateMulti"
        @blur="save()"
      >
        <option
          v-for="option in options"
          :key="`${typeof option.value}:${option.value}`"
          :value="option.value"
          :selected="
            Array.isArray(draft) &&
            draft.some((value) => Object.is(value, option.value))
          "
        >
          {{ option.label }}
        </option>
      </select>
      <textarea
        v-else-if="editor === 'textarea' || editor === 'json'"
        v-model="draft as string"
        class="yayaw-textarea yayaw-inline-editor"
        :disabled="pending || optionsLoading"
        :aria-label="formField?.label ?? column.header"
        autofocus
        @blur="save()"
      />
      <input
        v-else
        v-model="draft"
        :type="
          editor === 'number'
            ? 'number'
            : editor === 'date'
            ? 'date'
            : editor === 'url'
            ? 'url'
            : 'text'
        "
        class="yayaw-input yayaw-inline-editor"
        :disabled="pending || optionsLoading"
        :aria-label="formField?.label ?? column.header"
        autofocus
        @blur="save()"
      />
      <span v-if="error" class="yayaw-inline-error" role="alert">{{
        error
      }}</span>
      <button
        v-if="optionsFailed"
        type="button"
        class="yayaw-button yayaw-button-outline"
        @click.stop="begin"
      >
        Retry
      </button>
    </template>
    <VNodeRenderer v-else-if="customNode" :node="customNode" />
    <span
      v-else-if="effectiveColumn.type === 'boolean'"
      class="yayaw-boolean"
      :data-value="Boolean(value)"
      role="img"
      :aria-label="value ? 'True' : 'False'"
      ><span aria-hidden="true">{{ value ? "✓" : "—" }}</span></span
    >
    <code v-else-if="effectiveColumn.type === 'code'" class="yayaw-code">{{
      displayCellValue(value, effectiveColumn, context.locale)
    }}</code>
    <img
      v-else-if="imageUrl"
      :src="imageUrl"
      :alt="column.header"
      class="yayaw-cell-image"
      loading="lazy"
    />
    <a
      v-else-if="effectiveColumn.type === 'url' && url"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="yayaw-link"
      @click.stop
    >
      <template v-if="effectiveColumn.urlDisplayMode === 'icon'">↗</template>
      <template v-else-if="effectiveColumn.urlDisplayMode === 'domain'">{{
        urlDomain
      }}</template>
      <template v-else>{{ url }}</template>
    </a>
    <span
      v-else-if="
        effectiveColumn.type === 'select' ||
        effectiveColumn.type === 'multiSelect' ||
        effectiveColumn.type === 'tag' ||
        effectiveColumn.displayVariant === 'tag'
      "
      class="yayaw-tags"
    >
      <span
        v-for="tag in tags.filter(
          (item) => item !== null && item !== undefined && item !== ''
        )"
        :key="String(tag)"
        class="yayaw-tag"
        :class="effectiveColumn.tagColorMap?.[String(tag)]"
        >{{
          column.options?.find((option) => Object.is(option.value, tag))
            ?.label ?? tag
        }}</span
      >
    </span>
    <pre v-else-if="effectiveColumn.type === 'json'" class="yayaw-json">{{
      displayCellValue(value, effectiveColumn, context.locale)
    }}</pre>
    <span
      v-else
      :class="{ 'yayaw-number': effectiveColumn.type === 'number' }"
      >{{ displayCellValue(value, effectiveColumn, context.locale) }}</span
    >
    <span v-if="error && !editing" class="yayaw-inline-error" role="alert">{{
      error
    }}</span>
    <span
      v-if="pending && context.config.table.inlineEdit?.showDelayIndicator"
      class="yayaw-saving"
      :aria-label="String(context.translations.value.saving ?? 'Saving')"
    />
  </div>
</template>
