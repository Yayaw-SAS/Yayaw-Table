<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  ref,
  watch,
  type PropType,
  type VNodeChild,
} from "vue";
import {
  cloneFormValue,
  defaultFieldValue,
  formValuesEqual,
  validateFormFields,
} from "../../form-runtime";
import type {
  CollectionFieldColumnDefinition,
  FormFieldContext,
  FormFieldDefinition,
  TableRecord,
} from "../../types";
import DynamicField from "./DynamicField.vue";
import FormDialog from "./FormDialog.vue";

const props = defineProps<{
  field: FormFieldDefinition;
  modelValue: unknown;
  context: FormFieldContext;
  errors?: Record<string, string>;
  path: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: TableRecord[]] }>();
const items = computed(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as TableRecord[]) : []
);
const dialogMode = computed(() =>
  props.field.collectionMode
    ? props.field.collectionMode === "dialog"
    : Boolean(props.field.columns?.length)
);
const columns = computed<CollectionFieldColumnDefinition[]>(
  () =>
    props.field.columns ?? [
      { id: "item", header: props.field.itemLabel ?? "Item" },
    ]
);
const edit = ref<{
  index: number | null;
  values: TableRecord;
  source: TableRecord[];
}>();
const editErrors = ref<Record<string, string>>({});
const saving = ref(false);
const keys = ref<number[]>([]);
let keySequence = 0;
watch(
  items,
  (next, previous = []) => {
    const oldKeys = keys.value;
    const assigned = new Set<number>();
    const retained = new Set(
      next.map((item) => previous.indexOf(item)).filter((index) => index >= 0)
    );
    keys.value = next.map((item, index) => {
      const oldIndex = previous.indexOf(item);
      const candidate =
        oldIndex >= 0
          ? oldKeys[oldIndex]
          : !retained.has(index)
          ? oldKeys[index]
          : undefined;
      const key =
        candidate !== undefined && !assigned.has(candidate)
          ? candidate
          : keySequence++;
      assigned.add(key);
      return key;
    });
  },
  { immediate: true }
);
const update = (next: TableRecord[]): void => {
  if (!props.disabled) emit("update:modelValue", next);
};
const newItem = (create = props.field.createItem): TableRecord =>
  cloneFormValue(
    create?.(cloneFormValue(items.value)) ??
      Object.fromEntries(
        (props.field.itemFields ?? []).map((field) => [
          field.name,
          defaultFieldValue(field),
        ])
      )
  );
const open = (index: number | null, create = props.field.createItem): void => {
  if (props.disabled) return;
  editErrors.value = {};
  edit.value = {
    index,
    source: cloneFormValue(items.value),
    values:
      index === null
        ? newItem(create)
        : cloneFormValue(items.value[index] ?? {}),
  };
};
const add = (create = props.field.createItem): void => {
  if (props.disabled) return;
  if (dialogMode.value) open(null, create);
  else update([...items.value, newItem(create)]);
};
const changeItem = (index: number, next: TableRecord): void =>
  update(items.value.map((item, current) => (current === index ? next : item)));
const changeField = (index: number, name: string, value: unknown): void =>
  changeItem(index, { ...items.value[index], [name]: value });
const remove = (index: number): void =>
  update(items.value.filter((_, current) => current !== index));
const move = (index: number, offset: number): void => {
  if (
    props.disabled ||
    index + offset < 0 ||
    index + offset >= items.value.length
  )
    return;
  const next = [...items.value];
  const [item] = next.splice(index, 1);
  if (item) next.splice(index + offset, 0, item);
  update(next);
};
const changeDraft = (name: string, value: unknown): void => {
  if (edit.value && !saving.value && !props.disabled)
    edit.value.values = { ...edit.value.values, [name]: value };
};
const draftContext = computed<FormFieldContext>(() => ({
  ...props.context,
  values: edit.value?.values ?? {},
  setFieldValue: changeDraft,
  touchField: undefined,
}));
const save = async (): Promise<void> => {
  if (!edit.value || saving.value || props.disabled) return;
  const draft = edit.value;
  saving.value = true;
  try {
    const result = await validateFormFields(
      props.field.itemFields ?? [],
      draft.values,
      draftContext.value
    );
    if (edit.value !== draft || props.disabled) return;
    editErrors.value = result.errors;
    const issues = props.field.validateItem?.(result.values, draft.index) ?? [];
    if (issues.length) editErrors.value.form = issues.join("; ");
    if (!formValuesEqual(items.value, draft.source))
      editErrors.value.form =
        "The collection changed. Reopen this editor before saving.";
    const next =
      draft.index === null
        ? [...items.value, result.values]
        : items.value.map((item, index) =>
            index === draft.index ? result.values : item
          );
    const collectionIssues = props.field.validateItems?.(next) ?? [];
    if (collectionIssues.length)
      editErrors.value.form = collectionIssues.join("; ");
    if (Object.keys(editErrors.value).length) return;
    update(next);
    edit.value = undefined;
  } catch (cause) {
    editErrors.value.form =
      cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
};
const Node = defineComponent({
  props: { node: { type: null as unknown as PropType<VNodeChild> } },
  setup: (value) => () => h("span", {}, [value.node]),
});
const renderItem = (item: TableRecord, index: number | null, draft = false) =>
  props.field.renderItemForm?.({
    item,
    index,
    disabled: props.disabled || saving.value,
    onChange: (value) => {
      if (draft) {
        if (edit.value && !saving.value && !props.disabled)
          edit.value.values = cloneFormValue(value);
      } else if (index !== null) changeItem(index, value);
    },
  });
</script>

<template>
  <div class="yayaw-collection">
    <p v-if="!items.length && field.emptyLabel" class="yayaw-help">
      {{ field.emptyLabel }}
    </p>
    <div v-if="dialogMode" class="yayaw-collection-table-wrap">
      <table class="yayaw-collection-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.id">
              {{ column.header }}
            </th>
            <th><span class="yayaw-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in items"
            :key="field.getItemKey?.(item, index) ?? keys[index]"
          >
            <td v-for="column in columns" :key="column.id">
              <Node
                v-if="column.render"
                :node="column.render(item, index)"
              /><template v-else>{{
                item[column.id] ?? `${field.itemLabel ?? "Item"} ${index + 1}`
              }}</template>
            </td>
            <td>
              <button
                type="button"
                class="yayaw-button yayaw-button-outline"
                :disabled="disabled"
                @click="open(index)"
              >
                Edit</button
              ><button
                type="button"
                class="yayaw-icon-button"
                :disabled="disabled || index === 0"
                aria-label="Move item up"
                @click="move(index, -1)"
              >
                ↑</button
              ><button
                type="button"
                class="yayaw-icon-button"
                :disabled="disabled || index === items.length - 1"
                aria-label="Move item down"
                @click="move(index, 1)"
              >
                ↓</button
              ><button
                type="button"
                class="yayaw-icon-button yayaw-danger"
                :disabled="disabled"
                aria-label="Remove item"
                @click="remove(index)"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-for="(message, key) in Object.fromEntries(
          Object.entries(errors ?? {}).filter(([key]) =>
            key.startsWith(`${path}.`)
          )
        )"
        :key="key"
        class="yayaw-field-error"
        role="alert"
      >
        {{ message }}
      </p>
    </div>
    <template v-else>
      <article
        v-for="(item, index) in items"
        :key="field.getItemKey?.(item, index) ?? keys[index]"
        class="yayaw-collection-item"
      >
        <div class="yayaw-collection-actions">
          <span>{{ field.itemLabel }} {{ index + 1 }}</span
          ><button
            type="button"
            class="yayaw-icon-button"
            :disabled="disabled || index === 0"
            aria-label="Move item up"
            @click="move(index, -1)"
          >
            ↑</button
          ><button
            type="button"
            class="yayaw-icon-button"
            :disabled="disabled || index === items.length - 1"
            aria-label="Move item down"
            @click="move(index, 1)"
          >
            ↓</button
          ><button
            type="button"
            class="yayaw-icon-button yayaw-danger"
            :disabled="disabled"
            aria-label="Remove item"
            @click="remove(index)"
          >
            ×
          </button>
        </div>
        <Node v-if="field.renderItemForm" :node="renderItem(item, index)" />
        <DynamicField
          v-for="child in field.renderItemForm ? [] : field.itemFields ?? []"
          :key="child.name"
          :field="disabled ? { ...child, disabled: true } : child"
          :model-value="item[child.name]"
          :context="{
            ...context,
            values: item,
            setFieldValue: (name, value) => changeField(index, name, value),
            touchField: () => context.touchField?.(field.name),
          }"
          :errors="errors"
          :path="`${path}.${index}.${child.name}`"
          @update:model-value="changeField(index, child.name, $event)"
        />
        <p
          v-if="errors?.[`${path}.${index}`]"
          class="yayaw-field-error"
          role="alert"
        >
          {{ errors[`${path}.${index}`] }}
        </p>
      </article>
    </template>
    <button
      type="button"
      class="yayaw-button yayaw-button-outline"
      :disabled="disabled"
      @click="add()"
    >
      + {{ field.addLabel ?? "Add item" }}
    </button>
    <button
      v-for="action in field.createActions"
      :key="action.id ?? action.label"
      type="button"
      class="yayaw-button yayaw-button-outline"
      :disabled="disabled"
      @click="add(action.createItem)"
    >
      + {{ action.label }}
    </button>
    <FormDialog
      v-if="edit"
      :open="true"
      :title="`${edit.index === null ? 'Add' : 'Edit'} ${
        field.itemLabel ?? field.label
      }`"
      presentation="modal"
      :busy="saving"
      @close="edit = undefined"
    >
      <div class="yayaw-form">
        <p v-if="editErrors.form" class="yayaw-field-error" role="alert">
          {{ editErrors.form }}
        </p>
        <Node
          v-if="field.renderItemForm"
          :node="renderItem(edit.values, edit.index, true)"
        />
        <DynamicField
          v-for="child in field.renderItemForm ? [] : field.itemFields ?? []"
          :key="child.name"
          :field="saving || disabled ? { ...child, disabled: true } : child"
          :model-value="edit.values[child.name]"
          :context="draftContext"
          :errors="editErrors"
          @update:model-value="changeDraft(child.name, $event)"
        />
        <footer class="yayaw-form-footer">
          <button
            type="button"
            class="yayaw-button yayaw-button-outline"
            :disabled="saving"
            @click="edit = undefined"
          >
            Cancel</button
          ><button
            type="button"
            class="yayaw-button"
            :disabled="saving || disabled"
            @click="save"
          >
            {{ saving ? "Saving…" : "Save item" }}
          </button>
        </footer>
      </div>
    </FormDialog>
  </div>
</template>
