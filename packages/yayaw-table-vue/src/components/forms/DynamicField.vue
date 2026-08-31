<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  onMounted,
  type PropType,
  ref,
  type VNodeChild,
  watch,
} from "vue";
import type {
  FormFieldContext,
  FormFieldDefinition,
  SelectOption,
  TableRecord,
} from "../../types";

const props = defineProps<{
  field: FormFieldDefinition;
  modelValue: unknown;
  context: FormFieldContext;
  error?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: unknown] }>();
const options = ref<SelectOption[]>([]);
const localOptions = ref<SelectOption[]>([]);
const addingOption = ref(false);
const newOption = ref("");
const disabled = computed(() =>
  typeof props.field.disabled === "function"
    ? props.field.disabled(props.context)
    : props.field.disabled
);
const hidden = computed(() =>
  typeof props.field.hidden === "function"
    ? props.field.hidden(props.context)
    : props.field.hidden
);
const update = (value: unknown): void => emit("update:modelValue", value);
const allOptions = computed(() => {
  const result = [...options.value, ...localOptions.value];
  return result.filter(
    (option, index) =>
      result.findIndex(
        (candidate) => String(candidate.value) === String(option.value)
      ) === index
  );
});
const loadOptions = async (): Promise<void> => {
  const configured =
    typeof props.field.options === "function"
      ? await props.field.options(props.context)
      : (props.field.options ?? []);
  const loaded = props.field.optionsLoader
    ? (await props.field.optionsLoader()).map((value) => ({
        label: value,
        value,
      }))
    : [];
  options.value = [...configured, ...loaded];
};
const collection = computed<TableRecord[]>(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as TableRecord[]) : []
);
const addItem = (createItem = props.field.createItem): void => {
  const next =
    createItem?.(collection.value) ??
    Object.fromEntries(
      (props.field.itemFields ?? []).map((field) => [
        field.name,
        field.defaultValue ?? "",
      ])
    );
  update([...collection.value, next]);
};
const updateItem = (index: number, name: string, value: unknown): void => {
  update(
    collection.value.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [name]: value } : item
    )
  );
};
const replaceItem = (index: number, value: TableRecord): void =>
  update(
    collection.value.map((item, itemIndex) =>
      itemIndex === index ? value : item
    )
  );
const removeItem = (index: number): void =>
  update(collection.value.filter((_, itemIndex) => itemIndex !== index));
const moveItem = (index: number, offset: number): void => {
  const target = index + offset;
  if (target < 0 || target >= collection.value.length) {
    return;
  }
  const next = [...collection.value];
  const [item] = next.splice(index, 1);
  if (item) {
    next.splice(target, 0, item);
  }
  update(next);
};
const multiValues = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue.map(String) : []
);
const toggleMulti = (option: SelectOption, checked: boolean): void => {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const next = checked
    ? [
        ...current.filter((value) => String(value) !== String(option.value)),
        option.value,
      ]
    : current.filter((value) => String(value) !== String(option.value));
  update(next);
};
const selectValue = (event: Event): void => {
  const raw = (event.target as HTMLSelectElement).value;
  if (raw === "") {
    update("");
    return;
  }
  update(
    allOptions.value.find((option) => String(option.value) === raw)?.value ??
      raw
  );
};
const startAddingOption = (): void => {
  addingOption.value = true;
  props.field.onAddNew?.();
};
const addOption = (): void => {
  const value = newOption.value.trim();
  if (!value) {
    return;
  }
  localOptions.value.push({ label: value, value });
  update(value);
  newOption.value = "";
  addingOption.value = false;
};
const valueType = computed<"boolean" | "json" | "number" | "string">(() => {
  const dependency = props.field.dependsOn;
  const raw =
    props.field.type === "value-type"
      ? props.context.values[props.field.valueTypeField ?? ""]
      : dependency?.transform(props.context.values[dependency.field]);
  const candidate = String(raw ?? "string") as
    | "boolean"
    | "json"
    | "number"
    | "string";
  const supported = props.field.supportedTypes ?? [
    "boolean",
    "json",
    "number",
    "string",
  ];
  return supported.includes(candidate) ? candidate : "string";
});
const effectiveType = computed(() => {
  if (
    !["dynamic-value", "dynamicValue", "value-type"].includes(props.field.type)
  ) {
    return props.field.type;
  }
  if (valueType.value === "boolean") {
    return "switch";
  }
  if (valueType.value === "json") {
    return "textarea";
  }
  if (valueType.value === "number") {
    return "number";
  }
  return "text";
});
const inputValue = computed(() => {
  if (effectiveType.value === "date" && props.modelValue instanceof Date) {
    return props.modelValue.toISOString().slice(0, 10);
  }
  if (
    effectiveType.value === "textarea" &&
    valueType.value === "json" &&
    typeof props.modelValue === "object"
  ) {
    return JSON.stringify(props.modelValue, null, 2);
  }
  return props.modelValue;
});
const updateInput = (event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  if (effectiveType.value === "number") {
    update(raw === "" ? "" : Number(raw));
    return;
  }
  if (effectiveType.value === "textarea" && valueType.value === "json") {
    try {
      update(raw.trim() ? JSON.parse(raw) : {});
    } catch {
      /* keep the last valid JSON value */
    }
    return;
  }
  update(raw);
};
const customNode = computed(() =>
  props.field.renderField?.({
    field: {
      handleBlur: () => undefined,
      handleChange: update,
      name: props.field.name,
      state: {
        meta: {
          errors: props.error ? [props.error] : [],
          isValid: !props.error,
        },
        value: props.modelValue,
      },
    },
    form: {
      getFieldValue: (name) => props.context.values[name],
      setFieldValue: (name, value) => {
        if (name === props.field.name) {
          update(value);
        } else {
          props.context.values[name] = value;
        }
      },
    },
  })
);
const renderCollectionItem = (item: TableRecord, index: number): VNodeChild =>
  props.field.renderItemForm?.({
    disabled: Boolean(disabled.value),
    index,
    item,
    onChange: (value) => replaceItem(index, value),
  });
const dateLimit = (value?: Date | string): string | undefined =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;
const VNodeRenderer = defineComponent({
  props: {
    node: { type: null as unknown as PropType<VNodeChild>, required: true },
  },
  setup: (rendererProps) => () =>
    h("div", { class: "yayaw-custom-field" }, [rendererProps.node]),
});

onMounted(async () => {
  await loadOptions();
});
watch(
  () => props.context.values,
  async () => {
    if (typeof props.field.options === "function") {
      await loadOptions();
    }
  },
  { deep: true }
);
watch(valueType, (next, previous) => {
  if (
    next === previous ||
    !["dynamic-value", "dynamicValue", "value-type"].includes(props.field.type)
  ) {
    return;
  }
  if (next === "boolean") {
    update(props.modelValue === true || props.modelValue === "true");
  } else if (next === "number") {
    update(props.modelValue === "" ? 0 : Number(props.modelValue));
  } else if (next === "string") {
    update(String(props.modelValue ?? ""));
  } else if (typeof props.modelValue !== "object") {
    try {
      update(JSON.parse(String(props.modelValue)));
    } catch {
      update({});
    }
  }
});
</script>

<template>
  <div v-if="!hidden" class="yayaw-form-field" :data-type="field.type">
    <label :for="`yayaw-field-${field.name}`" class="yayaw-label">
      {{ field.label }} <span v-if="field.required" aria-hidden="true">*</span>
    </label>
    <p v-if="field.description" class="yayaw-help">{{ field.description }}</p>
    <component
      :is="field.component"
      v-if="field.type === 'custom' && field.component"
      :model-value="modelValue"
      :field="field"
      :context="context"
      @update:model-value="update"
    />
    <VNodeRenderer v-else-if="field.type === 'custom' && customNode" :node="customNode" />
    <textarea
      v-else-if="effectiveType === 'textarea'"
      :id="`yayaw-field-${field.name}`"
      class="yayaw-textarea"
      :value="inputValue as string"
      :placeholder="field.placeholder"
      :rows="field.rows ?? 4"
      :disabled="disabled"
      :required="field.required"
      @input="updateInput"
    />
    <div v-else-if="field.type === 'select-with-add-new'" class="yayaw-add-select">
      <div v-if="addingOption" class="yayaw-inline-group">
        <input v-model="newOption" class="yayaw-input" :placeholder="field.placeholder ?? 'New item'" @keydown.enter.prevent="addOption" @keydown.esc="addingOption = false" />
        <button type="button" class="yayaw-button" @click="addOption">+</button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="addingOption = false">×</button>
      </div>
      <div v-else class="yayaw-inline-group">
        <select :id="`yayaw-field-${field.name}`" class="yayaw-select" :value="modelValue" :disabled="disabled" :required="field.required" @change="selectValue">
          <option value="">{{ field.placeholder ?? 'Choose…' }}</option>
          <option v-for="option in allOptions" :key="String(option.value)" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
        </select>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="disabled" @click="startAddingOption">+ Add</button>
      </div>
    </div>
    <select
      v-else-if="field.type === 'select'"
      :id="`yayaw-field-${field.name}`"
      class="yayaw-select"
      :value="modelValue"
      :disabled="disabled"
      :required="field.required"
      @change="selectValue"
    >
      <option value="">{{ field.placeholder ?? 'Choose…' }}</option>
      <option v-for="option in allOptions" :key="String(option.value)" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
    </select>
    <div v-else-if="field.type === 'multiSelect'" class="yayaw-options-grid">
      <label v-for="option in allOptions" :key="String(option.value)" class="yayaw-checkbox-label">
        <input type="checkbox" :checked="multiValues.includes(String(option.value))" :disabled="disabled || option.disabled" @change="toggleMulti(option, ($event.target as HTMLInputElement).checked)" />
        {{ option.label }}
      </label>
    </div>
    <div v-else-if="field.type === 'radio'" class="yayaw-options-grid">
      <label v-for="option in allOptions" :key="String(option.value)" class="yayaw-checkbox-label">
        <input type="radio" :name="field.name" :value="option.value" :checked="String(modelValue) === String(option.value)" :disabled="disabled || option.disabled" @change="update(option.value)" />
        {{ option.label }}
      </label>
    </div>
    <label v-else-if="effectiveType === 'checkbox' || effectiveType === 'switch'" class="yayaw-switch">
      <input :id="`yayaw-field-${field.name}`" type="checkbox" :checked="Boolean(modelValue)" :disabled="disabled" @change="update(($event.target as HTMLInputElement).checked)" />
      <span>{{ field.placeholder }}</span>
    </label>
    <div v-else-if="field.type === 'collection'" class="yayaw-collection">
      <p v-if="!collection.length && field.emptyLabel" class="yayaw-help">{{ field.emptyLabel }}</p>
      <article v-for="(item, index) in collection" :key="field.getItemKey?.(item, index) ?? index" class="yayaw-collection-item">
        <div class="yayaw-collection-actions">
          <span v-if="field.itemLabel">{{ field.itemLabel }} {{ index + 1 }}</span>
          <button type="button" class="yayaw-icon-button" :disabled="index === 0" @click="moveItem(index, -1)">↑</button>
          <button type="button" class="yayaw-icon-button" :disabled="index === collection.length - 1" @click="moveItem(index, 1)">↓</button>
          <button type="button" class="yayaw-icon-button yayaw-danger" @click="removeItem(index)">×</button>
        </div>
        <VNodeRenderer v-if="field.renderItemForm" :node="renderCollectionItem(item, index)" />
        <template v-else>
          <DynamicField
            v-for="itemField in field.itemFields ?? []"
            :key="itemField.name"
            :field="itemField"
            :model-value="item[itemField.name]"
            :context="{ ...context, values: item }"
            @update:model-value="updateItem(index, itemField.name, $event)"
          />
        </template>
      </article>
      <button type="button" class="yayaw-button yayaw-button-outline" @click="addItem()">+ {{ field.addLabel ?? 'Add item' }}</button>
      <button v-for="action in field.createActions" :key="action.id ?? action.label" type="button" class="yayaw-button yayaw-button-outline" @click="addItem(action.createItem)">+ {{ action.label }}</button>
    </div>
    <input
      v-else
      :id="`yayaw-field-${field.name}`"
      class="yayaw-input"
      :type="effectiveType === 'number' ? 'number' : effectiveType === 'date' ? 'date' : effectiveType === 'url' ? 'url' : field.inputType ?? 'text'"
      :value="inputValue as string | number"
      :placeholder="field.placeholder"
      :min="effectiveType === 'date' ? dateLimit(field.minDate) : field.min"
      :max="effectiveType === 'date' ? dateLimit(field.maxDate) : field.max"
      :step="field.step"
      :disabled="disabled"
      :required="field.required"
      @input="updateInput"
    />
    <p v-if="error" class="yayaw-field-error" role="alert">{{ error }}</p>
  </div>
</template>
