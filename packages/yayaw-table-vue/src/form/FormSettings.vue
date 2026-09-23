<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from "lucide-vue-next";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { computed, ref, useId } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import {
  type FormColumn,
  type FormHiddenValue,
  type FormLabelKey,
  type FormQuestion,
  type FormViewSettings,
  formColumnEditor,
  formColumns,
  formHiddenChoices,
  formHiddenValueFrom,
  formHiddenValueText,
  formLabel,
  formQuestionList,
  formSettingsRows,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  toggleFormQuestion,
  updateFormQuestion,
} from "../form-view";
import FormSettingText from "./FormSettingText.vue";

/** View → Form settings: texts, questions and their order, fixed values and the end of the form. */
const props = defineProps<{ context: DisplayModeSettingsContext }>();
const id = `yayaw-form-settings-${useId()}`;
const label = (key: FormLabelKey, params?: Record<string, string>): string =>
  formLabel(
    key,
    props.context.locale,
    (name, fallback) => props.context.translate(`form.${name}`, fallback),
    params
  );
const columns = computed(
  () => props.context.columns as unknown as readonly FormColumn[]
);
const view = computed(
  () => normalizeFormViewConfig(props.context.settings) ?? {}
);
const merged = computed(() =>
  mergeFormSettings(props.context.defaults, props.context.settings)
);
const split = computed(() => formColumns(columns.value));
const questions = computed(() =>
  formQuestionList(columns.value, merged.value)
);
const rows = computed(() => formSettingsRows(columns.value, merged.value));
const notAsked = computed(() => {
  const asked = new Set(questions.value.map((question) => question.columnId));
  return split.value.eligible.filter((column) => !asked.has(column.id));
});
const hiddenValues = computed(() => merged.value.hiddenValues ?? {});
const editing = ref<string[]>([]);

const update = (patch: FormViewSettings): void =>
  props.context.updateSettings(
    normalizeFormViewConfig({ ...view.value, ...patch }) as
      | Record<string, unknown>
      | undefined
  );
const setQuestions = (next: FormQuestion[]): void =>
  update({ questions: next });
const ask = (columnId: string, asked: boolean): void =>
  setQuestions(toggleFormQuestion(questions.value, columnId, asked));
const move = (question: FormQuestion, offset: -1 | 1): void =>
  setQuestions(moveFormQuestion(questions.value, question.id, offset));
const change = (question: FormQuestion, patch: Partial<FormQuestion>): void =>
  setQuestions(updateFormQuestion(questions.value, question.id, patch));
const toggleEditing = (columnId: string): void => {
  editing.value = editing.value.includes(columnId)
    ? editing.value.filter((item) => item !== columnId)
    : [...editing.value, columnId];
};
const setHidden = (columnId: string, value: FormHiddenValue | undefined) => {
  const next = { ...hiddenValues.value };
  if (value === undefined) Reflect.deleteProperty(next, columnId);
  else next[columnId] = value;
  update({ hiddenValues: next });
};
const textInput = (column: FormColumn): boolean => {
  const editor = formColumnEditor(column);
  return editor !== "boolean" && editor !== "multiSelect";
};
const NONE = "";
/** Fixed values chosen from the column's options, as settings selects. */
const choiceFields = computed(() =>
  notAsked.value.flatMap((column) => {
    const options = formHiddenChoices(column);
    if (!options) return [];
    const value = hiddenValues.value[column.id];
    return [
      {
        id: `hidden-${column.id}`,
        label: label("hiddenValue", { label: column.header }),
        value: value === undefined ? NONE : String(value),
        options: [{ value: NONE, label: label("none") }, ...options],
        onChange: (next: string) =>
          setHidden(column.id, formHiddenValueFrom(column, next)),
      },
    ];
  })
);
const typedFixed = computed(() =>
  notAsked.value.filter((column) => !formHiddenChoices(column))
);
</script>

<template>
  <div class="yayaw-form-settings" data-form-settings>
    <ViewSettingsPanel :fields="choiceFields">
      <template #intro>
        <section class="yayaw-form-settings-section">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("settings") }}</h3>
          <FormSettingText :id="`${id}-title`" :label="label('title')" :value="merged.title ?? ''" @commit="update({ title: $event })" />
          <FormSettingText :id="`${id}-description`" :label="label('description')" multiline :value="merged.description ?? ''" @commit="update({ description: $event })" />
        </section>
        <section class="yayaw-form-settings-section">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("questions") }}</h3>
          <ul class="yayaw-form-settings-questions">
            <li
              v-for="row in rows"
              :key="row.column.id"
              class="yayaw-form-settings-item"
              :data-editing="Boolean(row.question && editing.includes(row.column.id)) || undefined"
              :data-form-setting-question="row.column.id"
            >
              <div class="yayaw-form-settings-row">
                <GripVertical :size="16" aria-hidden="true" class="yayaw-form-settings-grip" :data-hidden="!row.question || undefined" />
                <label
                  class="yayaw-form-settings-name"
                  :data-asked="Boolean(row.question) || undefined"
                  :for="`${id}-ask-${row.column.id}`"
                >
                  {{ row.column.header }}<span v-if="row.question?.required" class="yayaw-form-required" aria-hidden="true"> *</span>
                </label>
                <template v-if="row.question">
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
                    :aria-label="label('moveUp', { label: row.column.header })"
                    :disabled="row.index === 0"
                    @click="move(row.question, -1)"
                  >
                    <ArrowUp :size="14" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
                    :aria-label="label('moveDown', { label: row.column.header })"
                    :disabled="row.index === questions.length - 1"
                    @click="move(row.question, 1)"
                  >
                    <ArrowDown :size="14" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-form-settings-expand"
                    :aria-label="label('editQuestion', { label: row.column.header })"
                    :aria-expanded="editing.includes(row.column.id)"
                    :aria-controls="`${id}-details-${row.column.id}`"
                    @click="toggleEditing(row.column.id)"
                  >
                    <ChevronDown :size="14" aria-hidden="true" />
                  </button>
                </template>
                <SwitchRoot
                  :id="`${id}-ask-${row.column.id}`"
                  class="yayaw-switch-root yayaw-form-settings-ask"
                  data-size="sm"
                  :model-value="Boolean(row.question)"
                  :aria-label="label('ask', { label: row.column.header })"
                  @update:model-value="ask(row.column.id, $event === true)"
                >
                  <SwitchThumb class="yayaw-switch-thumb" />
                </SwitchRoot>
              </div>
              <div
                v-if="row.question && editing.includes(row.column.id)"
                :id="`${id}-details-${row.column.id}`"
                class="yayaw-form-settings-details"
              >
                <FormSettingText :id="`${id}-label-${row.column.id}`" :label="label('label')" :value="row.question.label ?? ''" @commit="change(row.question, { label: $event })" />
                <FormSettingText :id="`${id}-help-${row.column.id}`" :label="label('help')" multiline :value="row.question.help ?? ''" @commit="change(row.question, { help: $event })" />
                <FormSettingText
                  v-if="textInput(row.column)"
                  :id="`${id}-placeholder-${row.column.id}`"
                  :label="label('placeholder')"
                  :value="row.question.placeholder ?? ''"
                  @commit="change(row.question, { placeholder: $event })"
                />
                <div class="yayaw-form-switch-setting">
                  <label :id="`${id}-required-${row.column.id}-label`" class="yayaw-form-switch-label" :for="`${id}-required-${row.column.id}`">{{ label("requiredToggle") }}</label>
                  <SwitchRoot
                    :id="`${id}-required-${row.column.id}`"
                    class="yayaw-switch-root"
                    :model-value="row.question.required === true"
                    :aria-labelledby="`${id}-required-${row.column.id}-label`"
                    @update:model-value="change(row.question, { required: $event === true })"
                  >
                    <SwitchThumb class="yayaw-switch-thumb" />
                  </SwitchRoot>
                </div>
              </div>
            </li>
          </ul>
          <p v-if="split.excluded.length" class="yayaw-form-settings-note">
            {{ label("excluded", { columns: split.excluded.map((column) => column.header).join(", ") }) }}
          </p>
        </section>
        <div v-if="notAsked.length" class="yayaw-form-settings-hidden">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("hidden") }}</h3>
          <p class="yayaw-form-settings-note">{{ label("hiddenHint") }}</p>
        </div>
      </template>
      <FormSettingText
        v-for="column in typedFixed"
        :id="`${id}-hidden-${column.id}`"
        :key="column.id"
        :label="label('hiddenValue', { label: column.header })"
        :value="formHiddenValueText(hiddenValues[column.id])"
        @commit="setHidden(column.id, formHiddenValueFrom(column, $event))"
      />
      <section class="yayaw-form-settings-section">
        <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("afterSubmit") }}</h3>
        <FormSettingText :id="`${id}-submit`" :label="label('submitLabel')" :value="merged.submitLabel ?? ''" @commit="update({ submitLabel: $event })" />
        <FormSettingText :id="`${id}-success`" :label="label('successMessage')" multiline :value="merged.successMessage ?? ''" @commit="update({ successMessage: $event })" />
        <div class="yayaw-form-switch-setting">
          <label :id="`${id}-another-label`" class="yayaw-form-switch-label" :for="`${id}-another`">{{ label("allowAnother") }}</label>
          <SwitchRoot
            :id="`${id}-another`"
            class="yayaw-switch-root"
            :model-value="merged.allowAnotherResponse !== false"
            :aria-labelledby="`${id}-another-label`"
            @update:model-value="update({ allowAnotherResponse: $event === true })"
          >
            <SwitchThumb class="yayaw-switch-thumb" />
          </SwitchRoot>
        </div>
        <FormSettingText :id="`${id}-redirect`" :label="label('redirectUrl')" type="url" :value="merged.redirectUrl ?? ''" @commit="update({ redirectUrl: $event })" />
        <p class="yayaw-form-settings-note">{{ label("redirectHint") }}</p>
      </section>
      <button
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-form-settings-reset"
        :disabled="Object.keys(view).length === 0"
        @click="props.context.updateSettings(undefined)"
      >
        {{ label("reset") }}
      </button>
    </ViewSettingsPanel>
  </div>
</template>
