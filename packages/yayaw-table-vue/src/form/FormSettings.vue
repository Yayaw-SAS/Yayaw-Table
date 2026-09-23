<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-vue-next";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { computed, ref, useId } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import type { FormRule } from "../form-conditions";
import {
  addFormSection,
  createFormRule,
  type FormColumn,
  type FormHiddenValue,
  type FormItem,
  type FormLabelKey,
  type FormQuestion,
  type FormSectionBreak,
  type FormTranslate,
  type FormViewSettings,
  formColumnEditor,
  formColumns,
  formHiddenChoices,
  formHiddenValueFrom,
  formHiddenValueText,
  formLabel,
  formQuestionList,
  formRuleFields,
  formRuleIssues,
  formRuleSummary,
  formRulesFor,
  formSettingsRows,
  isFormSection,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  removeFormRule,
  removeFormSection,
  resolveFormSettings,
  toggleFormQuestion,
  updateFormQuestion,
  upsertFormRule,
} from "../form-view";
import FormRuleEditor from "./FormRuleEditor.vue";
import FormSettingText from "./FormSettingText.vue";

/** View → Form settings: texts, layout, questions, sections and rules, fixed values and the end of the form. */
const props = defineProps<{ context: DisplayModeSettingsContext }>();
const id = `yayaw-form-settings-${useId()}`;
const translate: FormTranslate = (name, fallback) =>
  props.context.translate(`form.${name}`, fallback);
const label = (key: FormLabelKey, params?: Record<string, string>): string =>
  formLabel(key, props.context.locale, translate, params);
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
  const asked = new Set(
    questions.value.flatMap((item) => (isFormSection(item) ? [] : [item.columnId]))
  );
  return split.value.eligible.filter((column) => !asked.has(column.id));
});
const hiddenValues = computed(() => merged.value.hiddenValues ?? {});
const editing = ref<string[]>([]);
const steps = computed(() => merged.value.layout === "steps");

// Rules: the condition fields, problems and summaries of the saved rules.
const rules = computed(() => merged.value.rules ?? []);
const ruleFields = computed(() => formRuleFields(columns.value, merged.value));
const ruleIssues = computed(() => formRuleIssues(columns.value, merged.value));
const resolvedQuestions = computed(
  () =>
    resolveFormSettings(columns.value, undefined, { ...merged.value, rules: [] })
      .questions
);
const rulesOf = (questionId: string): FormRule[] =>
  formRulesFor(rules.value, questionId);
const fieldsFor = (questionId: string) =>
  ruleFields.value.filter((field) => field.id !== questionId);
const issuesOf = (rule: FormRule) =>
  ruleIssues.value.filter((issue) => issue.ruleId === rule.id);
const summary = (rule: FormRule): string =>
  formRuleSummary(rule, resolvedQuestions.value, props.context.locale, translate);

const update = (patch: FormViewSettings): void =>
  props.context.updateSettings(
    normalizeFormViewConfig({ ...view.value, ...patch }) as
      | Record<string, unknown>
      | undefined
  );
const setQuestions = (next: FormItem[]): void => update({ questions: next });
const ask = (columnId: string, asked: boolean): void =>
  setQuestions(toggleFormQuestion(questions.value, columnId, asked));
const move = (item: FormItem, offset: -1 | 1): void =>
  setQuestions(moveFormQuestion(questions.value, item.id, offset));
const change = (question: FormQuestion, patch: Partial<FormQuestion>): void =>
  setQuestions(updateFormQuestion(questions.value, question.id, patch));
const changeSection = (
  section: FormSectionBreak,
  patch: Partial<FormSectionBreak>
): void => setQuestions(updateFormQuestion(questions.value, section.id, patch));
const addSection = (): void =>
  setQuestions(addFormSection(questions.value).questions);
/** A section starts open when first shown untitled (as when just added); the toggle flips that. */
const firstOpen = new Map<string, boolean>();
const sectionOpen = (section: FormSectionBreak): boolean => {
  if (!firstOpen.has(section.id)) firstOpen.set(section.id, !section.title);
  return editing.value.includes(section.id) !== firstOpen.get(section.id);
};
const addRule = (questionId: string): void =>
  update({
    rules: upsertFormRule(rules.value, createFormRule(rules.value, questionId)),
  });
const toggleEditing = (key: string): void => {
  editing.value = editing.value.includes(key)
    ? editing.value.filter((item) => item !== key)
    : [...editing.value, key];
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
const rowKey = (row: (typeof rows.value)[number]): string =>
  row.kind === "section" ? row.section.id : row.column.id;
const sectionName = (section: FormSectionBreak): string =>
  section.title ?? label("untitledSection");
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
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("layout") }}</h3>
          <div class="yayaw-form-switch-setting">
            <label :id="`${id}-steps-label`" class="yayaw-form-switch-label" :for="`${id}-steps`">{{ label("layoutSteps") }}</label>
            <SwitchRoot
              :id="`${id}-steps`"
              class="yayaw-switch-root"
              :model-value="steps"
              :aria-labelledby="`${id}-steps-label`"
              @update:model-value="update({ layout: $event === true ? 'steps' : 'page' })"
            >
              <SwitchThumb class="yayaw-switch-thumb" />
            </SwitchRoot>
          </div>
          <div v-if="steps" class="yayaw-form-switch-setting">
            <label :id="`${id}-review-label`" class="yayaw-form-switch-label" :for="`${id}-review`">{{ label("review") }}</label>
            <SwitchRoot
              :id="`${id}-review`"
              class="yayaw-switch-root"
              :model-value="merged.review === true"
              :aria-labelledby="`${id}-review-label`"
              @update:model-value="update({ review: $event === true })"
            >
              <SwitchThumb class="yayaw-switch-thumb" />
            </SwitchRoot>
          </div>
        </section>
        <section class="yayaw-form-settings-section">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("questions") }}</h3>
          <ul class="yayaw-form-settings-questions">
            <template v-for="row in rows" :key="rowKey(row)">
              <li
                v-if="row.kind === 'section'"
                class="yayaw-form-settings-item yayaw-form-settings-section-row"
                :data-editing="sectionOpen(row.section) || undefined"
                :data-form-setting-section="row.section.id"
              >
                <div class="yayaw-form-settings-row">
                  <GripVertical :size="16" aria-hidden="true" class="yayaw-form-settings-grip" />
                  <span class="yayaw-form-settings-name yayaw-form-settings-section-name" data-asked>
                    <span class="yayaw-sr-only">{{ label("section") }}: </span>{{ sectionName(row.section) }}
                  </span>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
                    :aria-label="label('moveUp', { label: sectionName(row.section) })"
                    :disabled="row.index === 0"
                    @click="move(row.section, -1)"
                  >
                    <ArrowUp :size="14" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
                    :aria-label="label('moveDown', { label: sectionName(row.section) })"
                    :disabled="row.index === questions.length - 1"
                    @click="move(row.section, 1)"
                  >
                    <ArrowDown :size="14" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-form-settings-expand"
                    :aria-label="label('editSection', { label: sectionName(row.section) })"
                    :aria-expanded="sectionOpen(row.section)"
                    :aria-controls="`${id}-details-${row.section.id}`"
                    @click="toggleEditing(row.section.id)"
                  >
                    <ChevronDown :size="14" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
                    :aria-label="label('removeSection', { label: sectionName(row.section) })"
                    @click="update(removeFormSection(merged, row.section.id))"
                  >
                    <Trash2 :size="14" aria-hidden="true" />
                  </button>
                </div>
                <div
                  v-if="sectionOpen(row.section)"
                  :id="`${id}-details-${row.section.id}`"
                  class="yayaw-form-settings-details"
                >
                  <FormSettingText :id="`${id}-section-title-${row.section.id}`" :label="label('sectionTitle')" :value="row.section.title ?? ''" @commit="changeSection(row.section, { title: $event })" />
                  <FormSettingText :id="`${id}-section-description-${row.section.id}`" :label="label('sectionDescription')" multiline :value="row.section.description ?? ''" @commit="changeSection(row.section, { description: $event })" />
                </div>
              </li>
              <li
                v-else
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
                <ul v-if="row.question && rulesOf(row.question.id).length" class="yayaw-form-rule-summary" data-form-rule-summary>
                  <li v-for="rule in rulesOf(row.question.id)" :key="rule.id">{{ summary(rule) }}</li>
                </ul>
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
                  <section class="yayaw-form-rules" data-form-rules>
                    <h4 class="yayaw-form-rules-heading">{{ label("conditions") }}</h4>
                    <FormRuleEditor
                      v-for="rule in rulesOf(row.question.id)"
                      :key="rule.id"
                      :rule="rule"
                      :fields="fieldsFor(row.question.id)"
                      :issues="issuesOf(rule)"
                      :label="label"
                      :locale="context.locale"
                      :translate="translate"
                      @change="update({ rules: upsertFormRule(rules, $event) })"
                      @remove="update({ rules: removeFormRule(rules, rule.id) })"
                    />
                    <button
                      type="button"
                      class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
                      :disabled="fieldsFor(row.question.id).length === 0"
                      @click="addRule(row.question.id)"
                    >
                      <Plus :size="14" aria-hidden="true" />{{ label("addRule") }}
                    </button>
                  </section>
                </div>
              </li>
            </template>
          </ul>
          <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-settings-add" @click="addSection">
            <Plus :size="14" aria-hidden="true" />{{ label("addSection") }}
          </button>
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
