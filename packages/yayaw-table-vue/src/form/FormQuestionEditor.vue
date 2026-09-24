<script setup lang="ts">
/**
 * A question's properties in the language being edited: its label (the
 * column name by default), help, placeholder, option labels and "Required".
 * The default slot follows them (the Form settings put the conditions there).
 */
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { computed } from "vue";
import type { FormText } from "../form-text";
import {
  type FormColumn,
  type FormLabelKey,
  type FormQuestion,
  formColumnEditor,
  formOptions,
  setFormOptionLabel,
} from "../form-view";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";

const props = defineProps<{
  column: FormColumn;
  question: FormQuestion;
  editing: FormEditingLanguage;
  /** Prefix of the editor's control ids. */
  idPrefix: string;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{ change: [patch: Partial<FormQuestion>] }>();
const editor = computed(() => formColumnEditor(props.column));
const textInput = computed(
  () => editor.value !== "boolean" && editor.value !== "multiSelect"
);
const options = computed(() =>
  editor.value === "select" || editor.value === "multiSelect"
    ? formOptions(props.column.options)
    : []
);
const setOptionLabel = (option: unknown, text: FormText | undefined): void =>
  emit("change", {
    optionLabels: setFormOptionLabel(props.question, String(option), text),
  });
</script>

<template>
  <FormLocalizedText
    :id="`${idPrefix}-label`"
    :editing="editing"
    :label="label('label')"
    :text="question.label"
    :source="column.header"
    @change="emit('change', { label: $event })"
  />
  <FormLocalizedText
    :id="`${idPrefix}-help`"
    :editing="editing"
    :label="label('help')"
    :text="question.help"
    multiline
    @change="emit('change', { help: $event })"
  />
  <FormLocalizedText
    v-if="textInput"
    :id="`${idPrefix}-placeholder`"
    :editing="editing"
    :label="label('placeholder')"
    :text="question.placeholder"
    @change="emit('change', { placeholder: $event })"
  />
  <fieldset v-if="options.length" class="yayaw-form-option-labels" data-form-option-labels>
    <legend class="yayaw-form-rules-heading">{{ label("optionLabels") }}</legend>
    <FormLocalizedText
      v-for="(option, index) in options"
      :id="`${idPrefix}-option-${index}`"
      :key="String(option.value)"
      :editing="editing"
      :label="label('optionLabel', { option: option.label })"
      :text="question.optionLabels?.[String(option.value)]"
      :source="option.label"
      @change="setOptionLabel(option.value, $event)"
    />
  </fieldset>
  <div class="yayaw-form-switch-setting">
    <label :id="`${idPrefix}-required-label`" class="yayaw-form-switch-label" :for="`${idPrefix}-required`">{{ label("requiredToggle") }}</label>
    <SwitchRoot
      :id="`${idPrefix}-required`"
      class="yayaw-switch-root"
      :model-value="question.required === true"
      :aria-labelledby="`${idPrefix}-required-label`"
      @update:model-value="emit('change', { required: $event === true })"
    >
      <SwitchThumb class="yayaw-switch-thumb" />
    </SwitchRoot>
  </div>
  <slot />
</template>
