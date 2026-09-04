<script setup lang="ts">
import { useTableTranslation } from "../../context";
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  useId,
  type PropType,
  ref,
  type VNodeChild,
  watch,
} from "vue";
import { dynamicFieldType } from "../../form-runtime";
import { useFieldOptions } from "../../composables/use-field-options";
import CollectionField from "./CollectionField.vue";
import TablePickerField from "./TablePickerField.vue";
import type {
  FormFieldContext,
  FormFieldDefinition,
  SelectOption,
} from "../../types";

const label = useTableTranslation();
const props = defineProps<{
  field: FormFieldDefinition;
  modelValue: unknown;
  context: FormFieldContext;
  error?: string;
  errors?: Record<string, string>;
  path?: string;
  touched?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  fieldChange: [name: string, value: unknown];
}>();
const fieldId = `yayaw-field-${useId()}`;
const errorMessage = computed(
  () => props.error ?? props.errors?.[props.path ?? props.field.name]
);
const {
  query,
  options: allOptions,
  created: localOptions,
  loading: optionsLoading,
  error: optionsError,
  reload: reloadOptions,
} = useFieldOptions({
  field: () => props.field,
  context: () => props.context,
  value: () => props.modelValue,
});
const optionPending = ref(false);
const optionCreateError = ref<string>();
let createRequest: AbortController | undefined;
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
const update = (value: unknown): void => {
  if (!disabled.value) emit("update:modelValue", value);
};
const touch = (): void => props.context.touchField?.(props.field.name);
const selectionModel = computed({ get: () => props.modelValue, set: update });
const multiValues = computed<unknown[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : []
);
const toggleMulti = (option: SelectOption, checked: boolean): void => {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const next = checked
    ? [
        ...current.filter((value) => !Object.is(value, option.value)),
        option.value,
      ]
    : current.filter((value) => !Object.is(value, option.value));
  update(next);
};
const startAddingOption = (): void => {
  if (disabled.value) return;
  addingOption.value = true;
  props.field.onAddNew?.();
};
const cancelAddingOption = (): void => {
  createRequest?.abort();
  addingOption.value = false;
  optionPending.value = false;
};
const addOption = async (): Promise<void> => {
  const label = newOption.value.trim();
  if (!label || disabled.value || optionPending.value) return;
  const request = new AbortController();
  createRequest = request;
  optionPending.value = true;
  optionCreateError.value = undefined;
  try {
    const option = props.field.createOption
      ? await props.field.createOption(label, props.context, request.signal)
      : { label, value: label };
    if (request.signal.aborted) return;
    if (
      !option ||
      option.value === undefined ||
      option.value === null ||
      option.value === ""
    )
      throw new Error("The new option must have a persisted value");
    localOptions.value.push(option);
    update(option.value);
    newOption.value = "";
    addingOption.value = false;
  } catch (cause) {
    if (!request.signal.aborted)
      optionCreateError.value =
        cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (!request.signal.aborted) optionPending.value = false;
  }
};
watch(
  () =>
    JSON.stringify([
      props.field.name,
      props.field.optionsScope,
      disabled.value,
      hidden.value,
      ...(props.field.optionDependencies ?? []).map(
        (name) => props.context.values[name]
      ),
    ]),
  cancelAddingOption
);
onBeforeUnmount(() => createRequest?.abort());
const valueType = computed(() => dynamicFieldType(props.field, props.context));
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
      // Keep the last parsed value while the JSON draft is incomplete.
    }
    return;
  }
  update(raw);
};
const customNode = computed(() =>
  props.field.renderField?.({
    field: {
      handleBlur: touch,
      handleChange: update,
      name: props.field.name,
      state: {
        meta: {
          errors: errorMessage.value ? [errorMessage.value] : [],
          isValid: !errorMessage.value,
          isTouched: props.touched,
        },
        value: props.modelValue,
      },
    },
    form: {
      getFieldValue: (name) => props.context.values[name],
      setFieldValue: (name, value) => {
        if (disabled.value) return;
        if (props.context.setFieldValue) {
          props.context.setFieldValue(name, value);
        } else if (name === props.field.name) {
          update(value);
        } else {
          emit("fieldChange", name, value);
        }
      },
    },
  })
);
const dateLimit = (value?: Date | string): string | undefined =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;
const VNodeRenderer = defineComponent({
  props: {
    node: { type: null as unknown as PropType<VNodeChild>, required: true },
  },
  setup: (rendererProps) => () =>
    h("div", { class: "yayaw-custom-field" }, [rendererProps.node]),
});

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
  <div
    v-if="!hidden"
    class="yayaw-form-field"
    :data-type="field.type"
    :data-field-name="field.name"
    @focusout="touch"
  >
    <label :id="`${fieldId}-label`" :for="fieldId" class="yayaw-label">
      {{ field.label }} <span v-if="field.required" aria-hidden="true">*</span>
    </label>
    <p v-if="field.description" :id="`${fieldId}-help`" class="yayaw-help">
      {{ field.description }}
    </p>
    <template v-if="field.searchOptions">
      <input
        v-model="query"
        type="search"
        class="yayaw-input"
        :aria-label="`${field.label} ${label('searchOptions', 'search')}`"
        :disabled="disabled"
        autocomplete="off"
      />
    </template>
    <p v-if="optionsLoading" class="yayaw-help" role="status">{{ label("loading", "Loading…") }}</p>
    <div v-if="optionsError" class="yayaw-field-error" role="alert">
      {{ optionsError }}
      <button
        type="button"
        class="yayaw-button yayaw-button-outline"
        @click="reloadOptions"
      >
        {{ label("retry", "Retry") }}
      </button>
    </div>
    <component
      :is="field.component"
      v-if="field.type === 'custom' && field.component"
      :model-value="modelValue"
      :field="field"
      :context="context"
      :disabled="disabled"
      :error="errorMessage"
      @update:model-value="update"
    />
    <VNodeRenderer
      v-else-if="field.type === 'custom' && customNode"
      :node="customNode"
    />
    <textarea
      v-else-if="effectiveType === 'textarea'"
      :id="fieldId"
      class="yayaw-textarea"
      :value="inputValue as string"
      :placeholder="field.placeholder"
      :rows="field.rows ?? 4"
      :disabled="disabled"
      :required="field.required"
      :aria-invalid="Boolean(errorMessage)"
      :aria-describedby="
        errorMessage
          ? `${fieldId}-error`
          : field.description
          ? `${fieldId}-help`
          : undefined
      "
      @input="updateInput"
    />
    <div
      v-else-if="field.type === 'select-with-add-new'"
      class="yayaw-add-select"
    >
      <p v-if="optionCreateError" class="yayaw-field-error" role="alert">
        {{ optionCreateError }}
      </p>
      <div v-if="addingOption" class="yayaw-inline-group">
        <input
          v-model="newOption"
          class="yayaw-input"
          :placeholder="field.placeholder ?? label('newItem', 'New item')"
          @keydown.enter.prevent="addOption"
          @keydown.esc.prevent="cancelAddingOption"
          :disabled="optionPending"
        />
        <button
          type="button"
          class="yayaw-button"
          :disabled="optionPending || disabled"
          :aria-label="label('createOption', 'Create option')"
          @click="addOption"
        >
          +
        </button>
        <button
          type="button"
          class="yayaw-button yayaw-button-outline"
          :aria-label="label('cancelNewOption', 'Cancel new option')"
          @click="cancelAddingOption"
        >
          ×
        </button>
      </div>
      <div v-else class="yayaw-inline-group">
        <select
          :id="fieldId"
          class="yayaw-select"
          v-model="selectionModel"
          :disabled="disabled"
          :required="field.required"
        >
          <option value="">{{ field.placeholder ?? label("chooseOption", "Choose…") }}</option>
          <option
            v-for="option in allOptions"
            :key="`${typeof option.value}:${option.value}`"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
        </select>
        <button
          type="button"
          class="yayaw-button yayaw-button-outline"
          :disabled="disabled"
          @click="startAddingOption"
        >
          + Add
        </button>
      </div>
    </div>
    <select
      v-else-if="field.type === 'select'"
      :id="fieldId"
      class="yayaw-select"
      v-model="selectionModel"
      :disabled="disabled"
      :required="field.required"
      :aria-invalid="Boolean(errorMessage)"
      :aria-describedby="
        errorMessage
          ? `${fieldId}-error`
          : field.description
          ? `${fieldId}-help`
          : undefined
      "
    >
      <option value="">{{ field.placeholder ?? label("chooseOption", "Choose…") }}</option>
      <option
        v-for="option in allOptions"
        :key="`${typeof option.value}:${option.value}`"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <div v-else-if="field.type === 'multiSelect'" class="yayaw-options-grid">
      <label
        v-for="option in allOptions"
        :key="`${typeof option.value}:${option.value}`"
        class="yayaw-checkbox-label"
      >
        <input
          type="checkbox"
          :checked="multiValues.some((value) => Object.is(value, option.value))"
          :disabled="disabled || option.disabled"
          @change="
            toggleMulti(option, ($event.target as HTMLInputElement).checked)
          "
        />
        {{ option.label }}
      </label>
    </div>
    <div v-else-if="field.type === 'radio'" class="yayaw-options-grid">
      <label
        v-for="option in allOptions"
        :key="`${typeof option.value}:${option.value}`"
        class="yayaw-checkbox-label"
      >
        <input
          type="radio"
          :name="fieldId"
          :value="option.value"
          :checked="Object.is(modelValue, option.value)"
          :disabled="disabled || option.disabled"
          @change="update(option.value)"
        />
        {{ option.label }}
      </label>
    </div>
    <label
      v-else-if="effectiveType === 'checkbox' || effectiveType === 'switch'"
      class="yayaw-switch"
    >
      <input
        :id="fieldId"
        type="checkbox"
        :checked="Boolean(modelValue)"
        :disabled="disabled"
        @change="update(($event.target as HTMLInputElement).checked)"
      />
      <span>{{ field.placeholder }}</span>
    </label>
    <CollectionField
      v-else-if="field.type === 'collection'"
      :field="field"
      :model-value="modelValue"
      :context="context"
      :errors="errors"
      :path="path ?? field.name"
      :disabled="disabled"
      @update:model-value="update"
    />
    <TablePickerField
      v-else-if="field.type === 'tablePicker'"
      :id="fieldId"
      :field="field"
      :model-value="modelValue"
      :context="context"
      :disabled="disabled"
      @update:model-value="update"
    />
    <input
      v-else
      :id="fieldId"
      class="yayaw-input"
      :type="
        effectiveType === 'number'
          ? 'number'
          : effectiveType === 'date'
          ? 'date'
          : effectiveType === 'url'
          ? 'url'
          : field.inputType ?? 'text'
      "
      :value="inputValue as string | number"
      :placeholder="field.placeholder"
      :min="effectiveType === 'date' ? dateLimit(field.minDate) : field.min"
      :max="effectiveType === 'date' ? dateLimit(field.maxDate) : field.max"
      :step="field.step"
      :disabled="disabled"
      :required="field.required"
      :aria-invalid="Boolean(errorMessage)"
      :aria-describedby="
        errorMessage
          ? `${fieldId}-error`
          : field.description
          ? `${fieldId}-help`
          : undefined
      "
      @input="updateInput"
    />
    <p
      v-if="errorMessage"
      :id="`${fieldId}-error`"
      class="yayaw-field-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
