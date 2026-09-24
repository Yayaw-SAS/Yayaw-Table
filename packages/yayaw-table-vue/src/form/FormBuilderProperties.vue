<script setup lang="ts">
/**
 * The builder's right column: the properties of the selected entry, written in
 * the language being edited; a question's conditions are edited in place.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-vue-next";
import { computed, useId } from "vue";
import type { FormBuilderController, FormBuilderState } from "../form-builder";
import { formLanguageName } from "../form-text";
import {
  type FormLabelKey,
  type FormTranslate,
  formHiddenValueFrom,
  formHiddenValueText,
} from "../form-view";
import FormBuilderFormSettings from "./FormBuilderFormSettings.vue";
import FormConsentEditor from "./FormConsentEditor.vue";
import FormHiddenFieldEditor from "./FormHiddenFieldEditor.vue";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";
import FormQuestionEditor from "./FormQuestionEditor.vue";
import FormRulesList from "./FormRulesList.vue";
import FormSettingSelect from "./FormSettingSelect.vue";
import FormSettingText from "./FormSettingText.vue";

const props = defineProps<{
  controller: FormBuilderController;
  state: FormBuilderState;
  headingId: string;
  /** The table's language, for rule summaries. */
  locale: string;
  translate?: FormTranslate;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();

/** "None" of a fixed value chosen in a list (select options cannot be empty). */
const NONE = "__none";
const NON_WORD = /\W/g;
const id = `yayaw-form-builder-${useId()}`;
const idPrefix = computed(() => `${id}-${props.state.selected.replaceAll(NON_WORD, "-")}`);
const selection = computed(() => props.state.selection);
const editing = computed<FormEditingLanguage>(() => ({
  locale: props.state.locale,
  defaultLocale: props.state.defaultLocale,
  missingLabel: props.label("missingTranslation"),
}));
/** What is selected, and where it is. */
const heading = computed((): { title: string; subtitle?: string } => {
  const current = selection.value;
  switch (current.kind) {
    case "question":
      return {
        title: current.entry.name,
        subtitle: props.label("columnOf", { label: current.entry.column.header }),
      };
    case "section":
      return { title: current.entry.name, subtitle: props.label("section") };
    case "consent":
      return { title: props.label("consent"), subtitle: current.entry.name };
    case "hidden":
      return { title: current.entry.name, subtitle: props.label("hiddenField") };
    case "column":
      return { title: current.entry.name, subtitle: props.label("notInForm") };
    default:
      return { title: props.label("settingsTitle") };
  }
});
const translation = computed(() =>
  props.state.locale === props.state.defaultLocale
    ? undefined
    : props.label("translationHint", {
        language: formLanguageName(props.state.defaultLocale, props.locale),
      })
);
/** Place and count of an ordered item, for "Move up" and "Move down". */
const ordered = computed(() => {
  const current = selection.value;
  return current.kind === "question" ||
    current.kind === "section" ||
    current.kind === "consent"
    ? { id: current.entry.id, index: current.entry.index, count: current.count, name: current.entry.name }
    : undefined;
});
const fixedOptions = computed(() => {
  const current = selection.value;
  return current.kind === "column" && current.choices
    ? [{ value: NONE, label: props.label("none") }, ...current.choices]
    : [];
});
const fixedValue = computed(() => {
  const current = selection.value;
  return current.kind === "column" ? current.value : undefined;
});
const setFixed = (raw: string): void => {
  const current = selection.value;
  if (current.kind === "column") {
    props.controller.setFixedValue(
      current.entry.column.id,
      raw === NONE ? undefined : formHiddenValueFrom(current.entry.column, raw)
    );
  }
};
</script>

<template>
  <section class="yayaw-form-builder-properties" :aria-labelledby="headingId" data-form-builder-properties>
    <div class="yayaw-form-builder-pane-header yayaw-form-builder-properties-header">
      <h2 :id="headingId" class="yayaw-form-builder-pane-title">
        <span class="yayaw-sr-only">{{ label("builderProperties") }}: </span>{{ heading.title }}
      </h2>
      <p v-if="heading.subtitle" class="yayaw-form-builder-subtitle">{{ heading.subtitle }}</p>
    </div>
    <div class="yayaw-form-builder-scroll">
      <div :key="state.selected" class="yayaw-form-builder-properties-body">
        <slot name="language" />
        <p v-if="translation" class="yayaw-form-settings-note" data-form-translation-hint>{{ translation }}</p>
        <FormBuilderFormSettings
          v-if="selection.kind === 'form'"
          :controller="controller"
          :state="state"
          :editing="editing"
          :id-prefix="idPrefix"
          :label="label"
        />
        <template v-else-if="selection.kind === 'question'">
          <FormQuestionEditor
            :column="selection.entry.column"
            :question="selection.entry.question"
            :editing="editing"
            :id-prefix="idPrefix"
            :label="label"
            @change="controller.changeItem(selection.entry.id, $event)"
          />
          <section class="yayaw-form-rules yayaw-form-builder-rules" data-form-rules>
            <h3 class="yayaw-form-builder-section-title">{{ label("conditions") }}</h3>
            <ul v-if="selection.rules.summaries.length" class="yayaw-form-rule-summary" data-form-rule-summary>
              <li v-for="summary in selection.rules.summaries" :key="summary">{{ summary }}</li>
            </ul>
            <FormRulesList
              :rules="selection.rules.list"
              :fields="selection.rules.fields"
              :issues="selection.rules.issues"
              :questions="selection.rules.questions"
              :locale="locale"
              :translate="translate"
              :label="label"
              @add="controller.addRule(selection.entry.id)"
              @change="controller.changeRule($event)"
              @remove="controller.removeRule($event)"
            />
          </section>
        </template>
        <template v-else-if="selection.kind === 'section'">
          <FormLocalizedText
            :id="`${idPrefix}-title`"
            :editing="editing"
            :label="label('sectionTitle')"
            :text="selection.entry.section.title"
            @change="controller.changeItem(selection.entry.id, { title: $event })"
          />
          <FormLocalizedText
            :id="`${idPrefix}-description`"
            :editing="editing"
            :label="label('sectionDescription')"
            :text="selection.entry.section.description"
            multiline
            @change="controller.changeItem(selection.entry.id, { description: $event })"
          />
        </template>
        <FormConsentEditor
          v-else-if="selection.kind === 'consent'"
          :consent="selection.entry.consent"
          :editing="editing"
          :id-prefix="idPrefix"
          :label="label"
          @change="controller.changeItem(selection.entry.id, $event)"
        />
        <template v-else-if="selection.kind === 'hidden'">
          <p class="yayaw-form-settings-note">{{ label("hiddenFieldsHint") }}</p>
          <FormHiddenFieldEditor
            :field="selection.entry.field"
            :columns="selection.columns"
            :id-prefix="idPrefix"
            :label="label"
            @change="controller.changeHidden(selection.entry.id, $event)"
          />
          <div class="yayaw-form-builder-actions">
            <button
              type="button"
              class="yayaw-button yayaw-button-outline yayaw-form-builder-remove"
              :aria-label="label('removeSection', { label: selection.entry.name })"
              @click="controller.remove(selection.entry.id)"
            >
              <Trash2 :size="14" aria-hidden="true" />{{ label("remove") }}
            </button>
          </div>
        </template>
        <template v-else-if="selection.kind === 'column'">
          <p class="yayaw-form-settings-note">{{ label("notInFormHint") }}</p>
          <button
            type="button"
            class="yayaw-button yayaw-form-builder-ask"
            @click="controller.ask(selection.entry.column.id)"
          >
            <Plus :size="14" aria-hidden="true" />{{ label("askQuestion") }}
          </button>
          <section class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-fixed-title`">
            <h3 :id="`${idPrefix}-fixed-title`" class="yayaw-form-builder-section-title">{{ label("fixedValue") }}</h3>
            <FormSettingSelect
              v-if="selection.choices"
              :label="label('hiddenValue', { label: selection.entry.column.header })"
              :value="fixedValue === undefined ? NONE : String(fixedValue)"
              :options="fixedOptions"
              @change="setFixed"
            />
            <FormSettingText
              v-else
              :id="`${idPrefix}-fixed`"
              :label="label('hiddenValue', { label: selection.entry.column.header })"
              :value="formHiddenValueText(fixedValue)"
              @commit="setFixed"
            />
            <p class="yayaw-form-settings-note">{{ label("hiddenHint") }}</p>
          </section>
        </template>
        <div v-if="ordered" class="yayaw-form-builder-actions">
          <button
            type="button"
            class="yayaw-button yayaw-button-outline yayaw-icon-only"
            :aria-label="label('moveUp', { label: ordered.name })"
            :disabled="ordered.index === 0"
            @click="controller.move(ordered.id, -1)"
          >
            <ArrowUp :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="yayaw-button yayaw-button-outline yayaw-icon-only"
            :aria-label="label('moveDown', { label: ordered.name })"
            :disabled="ordered.index === ordered.count - 1"
            @click="controller.move(ordered.id, 1)"
          >
            <ArrowDown :size="16" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="yayaw-button yayaw-button-outline yayaw-form-builder-remove"
            :aria-label="selection.kind === 'question' ? undefined : label('removeSection', { label: ordered.name })"
            @click="controller.remove(ordered.id)"
          >
            <Trash2 :size="14" aria-hidden="true" />{{ selection.kind === "question" ? label("removeQuestion") : label("remove") }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
