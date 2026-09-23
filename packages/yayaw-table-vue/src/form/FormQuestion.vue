<script setup lang="ts">
import { computed } from "vue";
import type { FormDraft, ResolvedFormQuestion } from "../form-view";

type Answer = FormDraft[string];

/**
 * One question: its label, input, help text and error. Rendered on its own
 * so a step-by-step layout can show questions one at a time.
 */
const props = defineProps<{
  question: ResolvedFormQuestion;
  /** Id of the question's first control; the form focuses it on errors. */
  inputId: string;
  value?: Answer;
  error?: string;
  disabled?: boolean;
  /** Placeholder of the empty select option. */
  chooseLabel: string;
}>();
const emit = defineEmits<{ change: [value: Answer] }>();

const helpId = computed(() => `${props.inputId}-help`);
const errorId = computed(() => `${props.inputId}-error`);
const describedBy = computed(
  () =>
    [props.question.help && helpId.value, props.error && errorId.value]
      .filter(Boolean)
      .join(" ") || undefined
);
const text = computed(() => (typeof props.value === "string" ? props.value : ""));
const selected = computed(() => (Array.isArray(props.value) ? props.value : []));
const inputType = computed(() => {
  if (props.question.editor === "date") return "date";
  if (props.question.editor === "url") return "url";
  return "text";
});
const optionId = (index: number): string =>
  index === 0 ? props.inputId : `${props.inputId}-${index}`;
const onText = (event: Event): void =>
  emit("change", (event.target as HTMLInputElement).value);
const toggle = (key: string, checked: boolean): void =>
  emit(
    "change",
    checked ? [...selected.value, key] : selected.value.filter((item) => item !== key)
  );
</script>

<template>
  <fieldset
    v-if="question.editor === 'multiSelect'"
    class="yayaw-form-question yayaw-form-choices"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
    :aria-describedby="describedBy"
  >
    <legend class="yayaw-form-label">
      {{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span>
    </legend>
    <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
    <label
      v-for="(option, index) in question.options"
      :key="String(option.value)"
      class="yayaw-form-check"
      :for="optionId(index)"
    >
      <input
        :id="optionId(index)"
        type="checkbox"
        :checked="selected.includes(String(option.value))"
        :disabled="disabled"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        @change="toggle(String(option.value), ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ option.label }}</span>
    </label>
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </fieldset>
  <div
    v-else-if="question.editor === 'boolean'"
    class="yayaw-form-question"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
  >
    <label class="yayaw-form-check yayaw-form-label" :for="inputId">
      <input
        :id="inputId"
        type="checkbox"
        :checked="value === true"
        :disabled="disabled"
        :required="question.required"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        @change="emit('change', ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span></span>
    </label>
    <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </div>
  <div
    v-else
    class="yayaw-form-question"
    :data-form-question="question.id"
    :data-invalid="error ? true : undefined"
  >
    <label class="yayaw-form-label" :for="inputId">
      {{ question.label }}<span v-if="question.required" class="yayaw-form-required" aria-hidden="true">*</span>
    </label>
    <p v-if="question.help" :id="helpId" class="yayaw-form-help">{{ question.help }}</p>
    <textarea
      v-if="question.editor === 'textarea'"
      :id="inputId"
      class="yayaw-textarea"
      rows="4"
      :value="text"
      :placeholder="question.placeholder"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      @input="onText"
    />
    <select
      v-else-if="question.editor === 'select'"
      :id="inputId"
      class="yayaw-select"
      :value="text"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      @change="onText"
    >
      <option value="">{{ question.placeholder ?? chooseLabel }}</option>
      <option v-for="option in question.options" :key="String(option.value)" :value="String(option.value)">
        {{ option.label }}
      </option>
    </select>
    <input
      v-else
      :id="inputId"
      class="yayaw-input"
      :type="inputType"
      :inputmode="question.editor === 'number' ? 'decimal' : undefined"
      autocomplete="off"
      :value="text"
      :placeholder="question.placeholder"
      :disabled="disabled"
      :required="question.required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      @input="onText"
    />
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </div>
</template>
