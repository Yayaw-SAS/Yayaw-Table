<script setup lang="ts">
import { Check, ChevronDown, ChevronUp } from "lucide-vue-next";
import {
  CheckboxIndicator,
  CheckboxRoot,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectViewport,
  SwitchRoot,
  SwitchThumb,
} from "reka-ui";
import { computed, ref, useTemplateRef } from "vue";
import { useOverlayTheme } from "../composables/use-overlay-theme";
import {
  type FormDraft,
  type FormOption,
  formNumberDisplay,
  type ResolvedFormQuestion,
} from "../form-view";
import { tagAppearance } from "../tag-colors";
import "../tag-colors.css";
import FormDateField from "./FormDateField.vue";

type Answer = FormDraft[string];

/** Texts a question shows besides its own. */
interface FormQuestionLabels {
  /** Placeholder of an empty select. */
  choose: string;
  /** Placeholder of an empty date. */
  pickDate: string;
  /** Removes the picked date. */
  clearDate: string;
}

/**
 * One question: its label, control, help text and error, with the table's
 * form controls. Rendered on its own so a step-by-step layout can show
 * questions one at a time.
 */
const props = defineProps<{
  question: ResolvedFormQuestion;
  /** Id of the question's control; its label points at it. */
  inputId: string;
  value?: Answer;
  error?: string;
  disabled?: boolean;
  /** Language of dates and numbers. */
  locale: string;
  labels: FormQuestionLabels;
}>();
const emit = defineEmits<{ change: [value: Answer] }>();

const helpId = computed(() => `${props.inputId}-help`);
const errorId = computed(() => `${props.inputId}-error`);
const labelId = computed(() => `${props.inputId}-label`);
const describedBy = computed(
  () =>
    [props.question.help && helpId.value, props.error && errorId.value]
      .filter(Boolean)
      .join(" ") || undefined
);
const invalid = computed(() => (props.error ? true : undefined));
const text = computed(() => (typeof props.value === "string" ? props.value : ""));
const selected = computed(() => (Array.isArray(props.value) ? props.value : []));
const optionId = (index: number): string =>
  index === 0 ? props.inputId : `${props.inputId}-${index}`;
const onText = (event: Event): void =>
  emit("change", (event.target as HTMLInputElement).value);
const toggle = (key: string, checked: boolean): void =>
  emit(
    "change",
    checked ? [...selected.value, key] : selected.value.filter((item) => item !== key)
  );

// Numbers are typed plainly and shown with the column's number format.
const editing = ref(false);
const numberText = computed(() =>
  editing.value
    ? text.value
    : (formNumberDisplay(text.value, props.question.numberFormat, props.locale) ?? text.value)
);

// Selects portal their options: keep the table's theme on them.
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const selectedOption = computed(() =>
  props.question.options.find((option) => String(option.value) === text.value)
);
const tag = (option: FormOption) =>
  tagAppearance(String(option.value), props.question.coloredTags);
</script>

<template>
  <div
    v-if="question.editor === 'boolean'"
    class="yayaw-form-question"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
  >
    <div class="yayaw-form-switch-row">
      <div class="yayaw-form-question-header">
        <label :id="labelId" class="yayaw-form-label" :for="inputId">
          {{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span>
        </label>
        <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
      </div>
      <SwitchRoot
        :id="inputId"
        class="yayaw-switch-root"
        data-form-focus
        :model-value="value === true"
        :disabled="disabled"
        :aria-labelledby="labelId"
        :aria-describedby="describedBy"
        :aria-invalid="invalid"
        @update:model-value="emit('change', $event === true)"
      >
        <SwitchThumb class="yayaw-switch-thumb" />
      </SwitchRoot>
    </div>
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </div>
  <fieldset
    v-else-if="question.editor === 'multiSelect'"
    class="yayaw-form-question"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
    :aria-describedby="describedBy"
  >
    <legend :id="labelId" class="yayaw-form-label yayaw-form-legend">
      {{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span>
    </legend>
    <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
    <div class="yayaw-form-choices">
      <div v-for="(option, index) in question.options" :key="String(option.value)" class="yayaw-form-choice">
        <CheckboxRoot
          :id="optionId(index)"
          class="yayaw-checkbox"
          :data-form-focus="index === 0 ? true : undefined"
          :model-value="selected.includes(String(option.value))"
          :disabled="disabled"
          :aria-labelledby="`${optionId(index)}-label`"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
          @update:model-value="toggle(String(option.value), $event === true)"
        >
          <CheckboxIndicator class="yayaw-checkbox-indicator">
            <Check :size="14" aria-hidden="true" />
          </CheckboxIndicator>
        </CheckboxRoot>
        <label :id="`${optionId(index)}-label`" class="yayaw-form-choice-label" :for="optionId(index)">
          <span
            v-if="question.tags"
            class="yayaw-tag"
            :data-colored="tag(option).colored"
            :style="tag(option).style"
          >{{ option.label }}</span>
          <template v-else>{{ option.label }}</template>
        </label>
      </div>
    </div>
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </fieldset>
  <div
    v-else
    ref="anchor"
    class="yayaw-form-question"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
  >
    <div class="yayaw-form-question-header">
      <label :id="labelId" class="yayaw-form-label" :for="inputId">
        {{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span>
      </label>
      <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
    </div>
    <textarea
      v-if="question.editor === 'textarea'"
      :id="inputId"
      class="yayaw-textarea"
      data-form-focus
      rows="4"
      :value="text"
      :placeholder="question.placeholder"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @input="onText"
    />
    <SelectRoot
      v-else-if="question.editor === 'select'"
      :model-value="text || undefined"
      :disabled="disabled"
      @update:model-value="emit('change', typeof $event === 'string' ? $event : '')"
      @update:open="updateOpen"
    >
      <SelectTrigger
        :id="inputId"
        class="yayaw-select-trigger yayaw-form-select"
        data-form-focus
        data-slot="select-trigger"
        :aria-labelledby="labelId"
        :aria-describedby="describedBy"
        :aria-invalid="invalid"
        :aria-required="question.required || undefined"
      >
        <span v-if="selectedOption" class="yayaw-form-select-value">
          <span
            v-if="question.tags"
            class="yayaw-tag"
            :data-colored="tag(selectedOption).colored"
            :style="tag(selectedOption).style"
          >{{ selectedOption.label }}</span>
          <template v-else>{{ selectedOption.label }}</template>
        </span>
        <span v-else class="yayaw-form-select-value" data-placeholder>{{ question.placeholder ?? labels.choose }}</span>
        <SelectIcon as-child>
          <ChevronDown :size="16" aria-hidden="true" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="yayaw-column-menu yayaw-select-content"
          :style="overlayStyle"
          position="popper"
          :side-offset="4"
          :collision-padding="8"
          data-slot="select-content"
        >
          <SelectScrollUpButton class="yayaw-select-scroll">
            <ChevronUp :size="16" aria-hidden="true" />
          </SelectScrollUpButton>
          <SelectViewport class="yayaw-select-viewport">
            <SelectItem
              v-for="option in question.options"
              :key="String(option.value)"
              :value="String(option.value)"
              class="yayaw-column-menu-item yayaw-select-item"
              data-slot="select-item"
            >
              <SelectItemText>
                <span
                  v-if="question.tags"
                  class="yayaw-tag"
                  :data-colored="tag(option).colored"
                  :style="tag(option).style"
                >{{ option.label }}</span>
                <template v-else>{{ option.label }}</template>
              </SelectItemText>
              <SelectItemIndicator class="yayaw-control-indicator">
                <Check :size="16" aria-hidden="true" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
          <SelectScrollDownButton class="yayaw-select-scroll">
            <ChevronDown :size="16" aria-hidden="true" />
          </SelectScrollDownButton>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
    <FormDateField
      v-else-if="question.editor === 'date'"
      :id="inputId"
      :label-id="labelId"
      :value="text"
      :locale="locale"
      :placeholder="question.placeholder ?? labels.pickDate"
      :clear-label="labels.clearDate"
      :disabled="disabled"
      :invalid="Boolean(error)"
      :required="question.required"
      :described-by="describedBy"
      @change="emit('change', $event)"
    />
    <input
      v-else-if="question.editor === 'number'"
      :id="inputId"
      class="yayaw-input yayaw-form-number"
      data-form-focus
      inputmode="decimal"
      autocomplete="off"
      :value="numberText"
      :placeholder="question.placeholder"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @focus="editing = true"
      @blur="editing = false"
      @input="onText"
    />
    <input
      v-else
      :id="inputId"
      class="yayaw-input"
      data-form-focus
      :type="question.editor === 'url' ? 'url' : 'text'"
      :inputmode="question.editor === 'url' ? 'url' : undefined"
      autocomplete="off"
      :value="text"
      :placeholder="question.placeholder"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @input="onText"
    />
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </div>
</template>
