<script setup lang="ts">
import { tableContextKey, useTableTranslation } from "../../context";
import {
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  useId,
  type PropType,
  ref,
  type VNodeChild,
  watch,
} from "vue";
import { Check } from "lucide-vue-next";
import {
  CheckboxIndicator,
  CheckboxRoot,
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupRoot,
  SwitchRoot,
  SwitchThumb,
} from "reka-ui";
import { jsonFormDraft, jsonFormText, dataTypeDateInput, optionControlKey, optionControlValue } from "../../table-contracts";
import FormDateField from "../../form/FormDateField.vue";
import { formLabel } from "../../form-view";
import FieldSelect from "./FieldSelect.vue";
import { dynamicFieldType, fieldIsHidden, fieldIsRequired } from "../../form-runtime";
import { useFieldOptions } from "../../composables/use-field-options";
import CollectionField from "./CollectionField.vue";
import TablePickerField from "./TablePickerField.vue";
import LocationEditor from "../location/LocationEditor.vue";
import TagPicker from "../tags/TagPicker.vue";
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
// A field of a tags column picks from the host's catalog.
const tagCatalog = inject(tableContextKey, undefined)?.tags;
const tagColumn = computed(() =>
  props.field.type === "multiSelect" || props.field.type === "select"
    ? tagCatalog?.columnForField(props.field.name)
    : undefined
);
const createTag = computed(() => {
  const column = tagColumn.value;
  return column && tagCatalog?.canCreate(column.columnId)
    ? (name: string) => tagCatalog.create(column.columnId, name)
    : undefined;
});
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
// The field's `hidden` predicate and the form's rules (see form-conditions).
const hidden = computed(() => fieldIsHidden(props.field, props.context));
const required = computed(() => fieldIsRequired(props.field, props.context));
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
const valueType = computed(() => props.field.type === "json" ? "json" : dynamicFieldType(props.field, props.context));
const effectiveType = computed(() => {
  if (props.field.type === "json") return "textarea";
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
    return dataTypeDateInput(props.modelValue);
  }
  if (valueType.value === "json") return jsonFormText(props.modelValue);
  return props.modelValue;
});
const updateInput = (event: Event): void => {
  const raw = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  if (effectiveType.value === "number") {
    update(raw === "" ? "" : Number(raw));
    return;
  }
  if (effectiveType.value === "textarea" && valueType.value === "json") {
    update(jsonFormDraft(raw));
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
// The Form view's controls: dropdowns, a popover calendar, switches and checkboxes.
const locale = computed(() => props.context.locale ?? "en");
const choosePlaceholder = computed(
  () => props.field.placeholder ?? label("chooseOption", formLabel("choose", locale.value))
);
const describedBy = computed(() =>
  errorMessage.value
    ? `${fieldId}-error`
    : props.field.description
      ? `${fieldId}-help`
      : undefined
);
const optionChecked = (option: SelectOption): boolean =>
  multiValues.value.some((value) => Object.is(value, option.value));
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
      {{ field.label }} <span v-if="required" aria-hidden="true">*</span>
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
      :required="required"
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
    <template v-else-if="tagColumn && tagCatalog">
      <TagPicker
        :id="fieldId"
        :model-value="modelValue"
        mode="field"
        :tags="tagCatalog.tags(tagColumn.columnId)"
        :multiple="tagColumn.multiple"
        :labels="tagCatalog.labels.value"
        :label="field.label"
        :colored-tags="tagCatalog.coloredTags(tagColumn.columnId)"
        :disabled="disabled"
        :invalid="Boolean(errorMessage)"
        :described-by="describedBy"
        :placeholder="field.placeholder"
        :create="createTag"
        :load-error="tagCatalog.status(tagColumn.columnId) === 'error'"
        :retry="() => tagCatalog?.reload(tagColumn!.columnId)"
        @update:model-value="update"
      />
      <output v-if="tagCatalog.status(tagColumn.columnId) === 'loading'" class="yayaw-help">{{ tagCatalog.labels.value.loading }}</output>
    </template>
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
        <FieldSelect
          :id="fieldId"
          v-model="selectionModel"
          :options="allOptions"
          :placeholder="choosePlaceholder"
          :disabled="disabled"
          :required="required"
          :invalid="Boolean(errorMessage)"
          :labelled-by="`${fieldId}-label`"
          :described-by="describedBy"
        />
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
    <FieldSelect
      v-else-if="field.type === 'select'"
      :id="fieldId"
      v-model="selectionModel"
      :options="allOptions"
      :placeholder="choosePlaceholder"
      :disabled="disabled"
      :required="required"
      :invalid="Boolean(errorMessage)"
      :labelled-by="`${fieldId}-label`"
      :described-by="describedBy"
    />
    <div
      v-else-if="field.type === 'multiSelect'"
      class="yayaw-form-choices yayaw-field-choices"
      role="group"
      :aria-labelledby="`${fieldId}-label`"
      :aria-describedby="describedBy"
    >
      <div
        v-for="(option, index) in allOptions"
        :key="optionControlKey(option.value)"
        class="yayaw-form-choice"
      >
        <CheckboxRoot
          :id="index === 0 ? fieldId : `${fieldId}-${index}`"
          class="yayaw-checkbox"
          :model-value="optionChecked(option)"
          :disabled="disabled || option.disabled"
          :aria-invalid="Boolean(errorMessage) || undefined"
          @update:model-value="toggleMulti(option, $event === true)"
        >
          <CheckboxIndicator class="yayaw-checkbox-indicator">
            <Check :size="14" aria-hidden="true" />
          </CheckboxIndicator>
        </CheckboxRoot>
        <label class="yayaw-form-choice-label" :for="index === 0 ? fieldId : `${fieldId}-${index}`">{{ option.label }}</label>
      </div>
    </div>
    <RadioGroupRoot
      v-else-if="field.type === 'radio'"
      class="yayaw-form-choices yayaw-field-choices"
      :model-value="modelValue === undefined || modelValue === null || modelValue === '' ? undefined : optionControlKey(modelValue)"
      :disabled="disabled"
      :aria-labelledby="`${fieldId}-label`"
      :aria-describedby="describedBy"
      @update:model-value="update(optionControlValue(String($event)))"
    >
      <div
        v-for="(option, index) in allOptions"
        :key="optionControlKey(option.value)"
        class="yayaw-form-choice"
      >
        <RadioGroupItem
          :id="index === 0 ? fieldId : `${fieldId}-${index}`"
          class="yayaw-radio"
          :value="optionControlKey(option.value)"
          :disabled="option.disabled"
        >
          <RadioGroupIndicator class="yayaw-radio-indicator" />
        </RadioGroupItem>
        <label class="yayaw-form-choice-label" :for="index === 0 ? fieldId : `${fieldId}-${index}`">{{ option.label }}</label>
      </div>
    </RadioGroupRoot>
    <div
      v-else-if="field.type === 'checkbox' && field.variant !== 'switch'"
      class="yayaw-form-choice yayaw-field-toggle"
    >
      <CheckboxRoot
        :id="fieldId"
        class="yayaw-checkbox"
        :model-value="Boolean(modelValue)"
        :disabled="disabled"
        :aria-labelledby="`${fieldId}-label`"
        :aria-describedby="describedBy"
        @update:model-value="update($event === true)"
      >
        <CheckboxIndicator class="yayaw-checkbox-indicator">
          <Check :size="14" aria-hidden="true" />
        </CheckboxIndicator>
      </CheckboxRoot>
      <span v-if="field.placeholder" class="yayaw-form-choice-label">{{ field.placeholder }}</span>
    </div>
    <div
      v-else-if="effectiveType === 'checkbox' || effectiveType === 'switch'"
      class="yayaw-form-choice yayaw-field-toggle"
    >
      <SwitchRoot
        :id="fieldId"
        class="yayaw-switch-root"
        :model-value="Boolean(modelValue)"
        :disabled="disabled"
        :aria-labelledby="`${fieldId}-label`"
        :aria-describedby="describedBy"
        @update:model-value="update($event === true)"
      >
        <SwitchThumb class="yayaw-switch-thumb" />
      </SwitchRoot>
      <span v-if="field.placeholder" class="yayaw-form-choice-label">{{ field.placeholder }}</span>
    </div>
    <FormDateField
      v-else-if="effectiveType === 'date'"
      :id="fieldId"
      :label-id="`${fieldId}-label`"
      :value="dataTypeDateInput(modelValue)"
      :locale="locale"
      :placeholder="field.placeholder ?? formLabel('pickDate', locale)"
      :clear-label="formLabel('clearDate', locale)"
      :disabled="disabled"
      :invalid="Boolean(errorMessage)"
      :required="required"
      :described-by="describedBy"
      :min="dateLimit(field.minDate)"
      :max="dateLimit(field.maxDate)"
      @change="update($event)"
    />
    <LocationEditor
      v-else-if="effectiveType === 'location'"
      :input-id="fieldId"
      :value="modelValue"
      :label="field.label"
      :disabled="disabled"
      :invalid="Boolean(errorMessage)"
      :described-by="errorMessage ? `${fieldId}-error` : field.description ? `${fieldId}-help` : undefined"
      @change="update($event)"
    />
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
          : effectiveType === 'url'
          ? 'url'
          : field.inputType ?? 'text'
      "
      :value="inputValue as string | number"
      :placeholder="field.placeholder"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :disabled="disabled"
      :required="required"
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
