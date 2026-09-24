<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  ListFilter,
  Plus,
  Trash2,
} from "lucide-vue-next";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { computed, ref, useId } from "vue";
import ViewSettingsPanel from "../components/controls/ViewSettingsPanel.vue";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import type { FormRule } from "../form-conditions";
import {
  type FormText,
  formLanguage,
  formLanguageName,
  resolveFormText,
  uniqueFormLocales,
} from "../form-text";
import {
  addFormConsent,
  addFormHiddenField,
  addFormSection,
  createFormRule,
  type FormColumn,
  type FormConsentQuestion,
  type FormHiddenField,
  type FormHiddenSource,
  type FormHiddenValue,
  type FormItem,
  type FormLabelKey,
  type FormQuestion,
  type FormSectionBreak,
  type FormTranslate,
  type FormViewSettings,
  formAddableLocales,
  formColumnEditor,
  formColumns,
  formDefaultLocale,
  formHiddenChoices,
  formHiddenFieldColumns,
  formHiddenValueFrom,
  formHiddenValueText,
  formItemMissingTranslation,
  formLabel,
  formOptions,
  formOrderedItems,
  formQuestionList,
  formRuleFields,
  formRuleIssues,
  formRuleSummary,
  formRulesFor,
  formSettingsRows,
  formViewLocales,
  isFormQuestion,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  removeFormItem,
  removeFormRule,
  resolveFormSettings,
  setFormOptionLabel,
  toggleFormQuestion,
  updateFormHiddenField,
  updateFormQuestion,
  upsertFormRule,
} from "../form-view";
import FormConsentRow from "./FormConsentRow.vue";
import FormHiddenFieldRow from "./FormHiddenFieldRow.vue";
import FormLanguageSwitch from "./FormLanguageSwitch.vue";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";
import FormRuleEditor from "./FormRuleEditor.vue";
import FormRulesDialog from "./FormRulesDialog.vue";
import FormSettingText from "./FormSettingText.vue";

/** View → Form settings: languages, texts, layout, questions, sections, consents and rules, hidden fields, fixed values and the end of the form. */
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
const shownRows = computed(() => rows.value.filter((row) => row.kind !== "hidden"));
const hiddenRows = computed(() =>
  rows.value.flatMap((row) => (row.kind === "hidden" ? [row] : []))
);
const count = computed(() => formOrderedItems(questions.value).length);
const notAsked = computed(() => {
  const asked = new Set(
    questions.value.filter(isFormQuestion).map((item) => item.columnId)
  );
  return split.value.eligible.filter((column) => !asked.has(column.id));
});
const hiddenValues = computed(() => merged.value.hiddenValues ?? {});
const editing = ref<string[]>([]);
const steps = computed(() => merged.value.layout === "steps");

// Languages: the one being edited, the default one and "Add language".
const fallbackLocale = computed(() => formLanguage(props.context.locale) || "en");
const pinnedLocale = computed(() => formDefaultLocale(merged.value));
const defaultLocale = computed(() => pinnedLocale.value ?? fallbackLocale.value);
const languages = computed(() =>
  formViewLocales(props.context.defaults, props.context.settings, fallbackLocale.value)
);
const addable = computed(() =>
  formAddableLocales(props.context.defaults, languages.value)
);
const localeChoice = ref<string>();
const editingLocale = computed(() =>
  localeChoice.value && languages.value.includes(localeChoice.value)
    ? localeChoice.value
    : defaultLocale.value
);
const language = computed<FormEditingLanguage>(() => ({
  locale: editingLocale.value,
  defaultLocale: defaultLocale.value,
  missingLabel: label("missingTranslation"),
}));
const translationHint = computed(() =>
  label("translationHint", {
    language: formLanguageName(defaultLocale.value, props.context.locale),
  })
);

// Rules: the condition fields, problems and summaries of the saved rules.
const rules = computed(() => merged.value.rules ?? []);
const ruleFields = computed(() =>
  formRuleFields(columns.value, merged.value, props.context.locale)
);
const ruleIssues = computed(() => formRuleIssues(columns.value, merged.value));
const resolvedQuestions = computed(
  () =>
    resolveFormSettings(
      columns.value,
      undefined,
      { ...merged.value, rules: [] },
      props.context.locale
    ).questions
);
const rulesOf = (questionId: string): FormRule[] =>
  formRulesFor(rules.value, questionId);
const fieldsFor = (questionId: string) =>
  ruleFields.value.filter((field) => field.id !== questionId);
const issuesOf = (rule: FormRule) =>
  ruleIssues.value.filter((issue) => issue.ruleId === rule.id);
const hasIssues = (questionId: string): boolean =>
  rulesOf(questionId).some((rule) => issuesOf(rule).length > 0);
/** The question whose conditions are edited in the dialog. */
const rulesOpen = ref<string | null>(null);
const summary = (rule: FormRule): string =>
  formRuleSummary(rule, resolvedQuestions.value, props.context.locale, translate);
/** A question's name in the table's language, for its conditions dialog. */
const questionTitle = (question: FormQuestion, column: FormColumn): string =>
  resolveFormText(question.label, props.context.locale, defaultLocale.value) ??
  column.header;

const update = (patch: FormViewSettings): void =>
  props.context.updateSettings(
    normalizeFormViewConfig({ ...view.value, ...patch }) as
      | Record<string, unknown>
      | undefined
  );
/** Texts written in another language pin the default one, so plain texts keep theirs. */
const write = (patch: FormViewSettings): void =>
  update(
    editingLocale.value === defaultLocale.value || pinnedLocale.value
      ? patch
      : { ...patch, defaultLocale: defaultLocale.value }
  );
const addLanguage = (added: string): void => {
  update({
    locales: uniqueFormLocales([...languages.value, added]),
    defaultLocale: defaultLocale.value,
  });
  localeChoice.value = added;
};
const setQuestions = (next: FormItem[]): void => write({ questions: next });
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
const changeConsent = (
  consent: FormConsentQuestion,
  patch: Partial<FormConsentQuestion>
): void => setQuestions(updateFormQuestion(questions.value, consent.id, patch));
const addSection = (): void =>
  setQuestions(addFormSection(questions.value).questions);
const addConsent = (): void =>
  setQuestions(addFormConsent(questions.value).questions);
const remove = (itemId: string): void => update(removeFormItem(merged.value, itemId));
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

// Hidden fields: the open one follows its id, which follows its source.
const openHidden = ref<string | null>(null);
const changeHidden = (
  field: FormHiddenField,
  patch: { source?: FormHiddenSource; columnId?: string }
): void => {
  const next = updateFormHiddenField(questions.value, field.id, patch);
  openHidden.value = next.id;
  update({ questions: next.questions });
};
const addHidden = (): void => {
  const next = addFormHiddenField(questions.value);
  openHidden.value = next.id;
  update({ questions: next.questions });
};
const hiddenColumns = (field: FormHiddenField) =>
  formHiddenFieldColumns(columns.value, questions.value, field.id);

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
const choiceOptions = (column: FormColumn) => {
  const editor = formColumnEditor(column);
  return editor === "select" || editor === "multiSelect"
    ? formOptions(column.options)
    : [];
};
const setOptionLabel = (
  question: FormQuestion,
  option: unknown,
  text: FormText | undefined
): void =>
  change(question, {
    optionLabels: setFormOptionLabel(question, String(option), text),
  });
const missing = (item: FormItem, column?: FormColumn): boolean =>
  formItemMissingTranslation(
    item,
    editingLocale.value,
    defaultLocale.value,
    column
  );
const rowKey = (row: (typeof rows.value)[number]): string => {
  if (row.kind === "section") return row.section.id;
  if (row.kind === "consent") return row.consent.id;
  return row.kind === "hidden" ? row.field.id : row.column.id;
};
const sectionName = (section: FormSectionBreak): string =>
  resolveFormText(section.title, editingLocale.value, defaultLocale.value) ??
  label("untitledSection");
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
        <div class="yayaw-form-settings-languages">
          <FormLanguageSwitch
            :label="label('editingLanguage')"
            :languages="languages"
            :value="editingLocale"
            :addable="addable"
            :add-label="label('addLanguage')"
            can-add
            @change="localeChoice = $event"
            @add="addLanguage"
          />
          <p
            v-if="editingLocale !== defaultLocale"
            class="yayaw-form-settings-note"
            data-form-translation-hint
          >
            {{ translationHint }}
          </p>
        </div>
        <section class="yayaw-form-settings-section">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("settings") }}</h3>
          <FormLocalizedText :id="`${id}-title`" :editing="language" :label="label('title')" :text="merged.title" @change="write({ title: $event })" />
          <FormLocalizedText :id="`${id}-description`" :editing="language" :label="label('description')" :text="merged.description" multiline @change="write({ description: $event })" />
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
            <template v-for="row in shownRows" :key="rowKey(row)">
              <FormConsentRow
                v-if="row.kind === 'consent'"
                :consent="row.consent"
                :index="row.index"
                :count="count"
                :editing="language"
                :label="label"
                @change="changeConsent(row.consent, $event)"
                @move="move(row.consent, $event)"
                @remove="remove(row.consent.id)"
              />
              <li
                v-else-if="row.kind === 'section'"
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
                    :disabled="row.index === count - 1"
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
                    @click="remove(row.section.id)"
                  >
                    <Trash2 :size="14" aria-hidden="true" />
                  </button>
                </div>
                <p v-if="missing(row.section)" class="yayaw-form-missing-line" data-form-missing-translation>
                  <span class="yayaw-form-missing">{{ language.missingLabel }}</span>
                </p>
                <div
                  v-if="sectionOpen(row.section)"
                  :id="`${id}-details-${row.section.id}`"
                  class="yayaw-form-settings-details"
                >
                  <FormLocalizedText :id="`${id}-section-title-${row.section.id}`" :editing="language" :label="label('sectionTitle')" :text="row.section.title" @change="changeSection(row.section, { title: $event })" />
                  <FormLocalizedText :id="`${id}-section-description-${row.section.id}`" :editing="language" :label="label('sectionDescription')" :text="row.section.description" multiline @change="changeSection(row.section, { description: $event })" />
                </div>
              </li>
              <li
                v-else-if="row.kind === 'question'"
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
                      :disabled="row.index === count - 1"
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
                <p v-if="row.question && missing(row.question, row.column)" class="yayaw-form-missing-line" data-form-missing-translation>
                  <span class="yayaw-form-missing">{{ language.missingLabel }}</span>
                </p>
                <div
                  v-if="row.question && editing.includes(row.column.id)"
                  :id="`${id}-details-${row.column.id}`"
                  class="yayaw-form-settings-details"
                >
                  <FormLocalizedText :id="`${id}-label-${row.column.id}`" :editing="language" :label="label('label')" :text="row.question.label" :source="row.column.header" @change="change(row.question, { label: $event })" />
                  <FormLocalizedText :id="`${id}-help-${row.column.id}`" :editing="language" :label="label('help')" :text="row.question.help" multiline @change="change(row.question, { help: $event })" />
                  <FormLocalizedText
                    v-if="textInput(row.column)"
                    :id="`${id}-placeholder-${row.column.id}`"
                    :editing="language"
                    :label="label('placeholder')"
                    :text="row.question.placeholder"
                    @change="change(row.question, { placeholder: $event })"
                  />
                  <fieldset v-if="choiceOptions(row.column).length" class="yayaw-form-option-labels" data-form-option-labels>
                    <legend class="yayaw-form-rules-heading">{{ label("optionLabels") }}</legend>
                    <FormLocalizedText
                      v-for="(option, index) in choiceOptions(row.column)"
                      :id="`${id}-option-${row.column.id}-${index}`"
                      :key="String(option.value)"
                      :editing="language"
                      :label="label('optionLabel', { option: option.label })"
                      :text="row.question.optionLabels?.[String(option.value)]"
                      :source="option.label"
                      @change="setOptionLabel(row.question, option.value, $event)"
                    />
                  </fieldset>
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
                    <p v-if="rulesOf(row.question.id).length === 0" class="yayaw-form-rules-status">{{ label("noConditions") }}</p>
                    <p v-if="hasIssues(row.question.id)" class="yayaw-form-rules-status yayaw-rule-issue" data-form-rules-problem>
                      {{ label("conditionsProblem") }}
                    </p>
                    <button
                      type="button"
                      class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
                      :disabled="fieldsFor(row.question.id).length === 0 && rulesOf(row.question.id).length === 0"
                      @click="rulesOpen = row.question.id"
                    >
                      <ListFilter :size="14" aria-hidden="true" />{{ label("editConditions") }}
                    </button>
                    <FormRulesDialog
                      :open="rulesOpen === row.question.id"
                      :title="label('conditionsTitle', { label: questionTitle(row.question, row.column) })"
                      :description="label('conditionsDescription')"
                      :done-label="label('done')"
                      :close-label="label('close')"
                      @update:open="rulesOpen = $event ? row.question.id : null"
                    >
                      <FormRuleEditor
                        v-for="rule in rulesOf(row.question.id)"
                        :key="rule.id"
                        :rule="rule"
                        :fields="fieldsFor(row.question.id)"
                        :issues="issuesOf(rule)"
                        :label="label"
                        :locale="context.locale"
                        :questions="resolvedQuestions"
                        :translate="translate"
                        @change="update({ rules: upsertFormRule(rules, $event) })"
                        @remove="update({ rules: removeFormRule(rules, rule.id) })"
                      />
                      <p v-if="rulesOf(row.question.id).length === 0" class="yayaw-form-rules-empty">{{ label("noConditions") }}</p>
                      <button
                        type="button"
                        class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
                        :disabled="fieldsFor(row.question.id).length === 0"
                        @click="addRule(row.question.id)"
                      >
                        <Plus :size="14" aria-hidden="true" />{{ label("addRule") }}
                      </button>
                    </FormRulesDialog>
                  </section>
                </div>
              </li>
            </template>
          </ul>
          <div class="yayaw-form-settings-buttons">
            <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-settings-add" @click="addSection">
              <Plus :size="14" aria-hidden="true" />{{ label("addSection") }}
            </button>
            <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-settings-add" @click="addConsent">
              <Plus :size="14" aria-hidden="true" />{{ label("addConsent") }}
            </button>
          </div>
          <p v-if="split.excluded.length" class="yayaw-form-settings-note">
            {{ label("excluded", { columns: split.excluded.map((column) => column.header).join(", ") }) }}
          </p>
        </section>
        <section class="yayaw-form-settings-section">
          <h3 class="yayaw-setting-heading" data-setting-heading>{{ label("hiddenFields") }}</h3>
          <p class="yayaw-form-settings-note">{{ label("hiddenFieldsHint") }}</p>
          <ul v-if="hiddenRows.length" class="yayaw-form-settings-questions" data-form-hidden-fields>
            <FormHiddenFieldRow
              v-for="row in hiddenRows"
              :key="row.field.id"
              :field="row.field"
              :columns="hiddenColumns(row.field)"
              :open="openHidden === row.field.id"
              :label="label"
              @change="changeHidden(row.field, $event)"
              @remove="remove(row.field.id)"
              @toggle="openHidden = openHidden === row.field.id ? null : row.field.id"
            />
          </ul>
          <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-settings-add" @click="addHidden">
            <Plus :size="14" aria-hidden="true" />{{ label("addHiddenField") }}
          </button>
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
        <FormLocalizedText :id="`${id}-submit`" :editing="language" :label="label('submitLabel')" :text="merged.submitLabel" :fallback="formLabel('submit', editingLocale)" @change="write({ submitLabel: $event })" />
        <FormLocalizedText :id="`${id}-success`" :editing="language" :label="label('successMessage')" :text="merged.successMessage" :fallback="formLabel('success', editingLocale)" multiline @change="write({ successMessage: $event })" />
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
        <FormLocalizedText :id="`${id}-closed`" :editing="language" :label="label('closedMessage')" :text="merged.closedMessage" :fallback="formLabel('closed', editingLocale)" multiline @change="write({ closedMessage: $event })" />
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
