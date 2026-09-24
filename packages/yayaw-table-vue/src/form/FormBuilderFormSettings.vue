<script setup lang="ts">
/** The form's own settings in the builder: texts, layout, languages, the end of the form and the view. */
import { computed } from "vue";
import type { FormBuilderController, FormBuilderState } from "../form-builder";
import { formLanguageName } from "../form-text";
import { type FormLabelKey, formLabel } from "../form-view";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";
import FormSettingSelect from "./FormSettingSelect.vue";
import FormSettingSwitch from "./FormSettingSwitch.vue";
import FormSettingText from "./FormSettingText.vue";

const props = defineProps<{
  controller: FormBuilderController;
  state: FormBuilderState;
  editing: FormEditingLanguage;
  idPrefix: string;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const form = computed(() => props.state.form);
const steps = computed(() => props.state.layout === "steps");
const languageOptions = computed(() =>
  props.state.languages.map((locale) => ({
    value: locale,
    label: formLanguageName(locale),
  }))
);
/** Built-in texts in the language being edited. */
const builtIn = (key: FormLabelKey): string => formLabel(key, props.editing.locale);
</script>

<template>
  <section class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-form`">
    <h3 :id="`${idPrefix}-form`" class="yayaw-form-builder-section-title">{{ label("settings") }}</h3>
    <FormLocalizedText
      :id="`${idPrefix}-title`"
      :editing="editing"
      :label="label('title')"
      :text="form.title"
      @change="controller.write({ title: $event })"
    />
    <FormLocalizedText
      :id="`${idPrefix}-description`"
      :editing="editing"
      :label="label('description')"
      :text="form.description"
      multiline
      @change="controller.write({ description: $event })"
    />
  </section>
  <section class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-layout`">
    <h3 :id="`${idPrefix}-layout`" class="yayaw-form-builder-section-title">{{ label("layout") }}</h3>
    <FormSettingSwitch
      :id="`${idPrefix}-steps`"
      :label="label('layoutSteps')"
      :checked="steps"
      @change="controller.setLayout($event ? 'steps' : 'page')"
    />
    <FormSettingSwitch
      v-if="steps"
      :id="`${idPrefix}-review`"
      :label="label('review')"
      :checked="form.review === true"
      @change="controller.update({ review: $event })"
    />
  </section>
  <section v-if="state.languages.length > 1" class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-languages`">
    <h3 :id="`${idPrefix}-languages`" class="yayaw-form-builder-section-title">{{ label("languages") }}</h3>
    <FormSettingSelect
      :label="label('defaultLanguage')"
      :value="state.defaultLocale"
      :options="languageOptions"
      @change="controller.setDefaultLocale($event)"
    />
  </section>
  <section class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-after`">
    <h3 :id="`${idPrefix}-after`" class="yayaw-form-builder-section-title">{{ label("afterSubmit") }}</h3>
    <FormLocalizedText
      :id="`${idPrefix}-submit`"
      :editing="editing"
      :label="label('submitLabel')"
      :text="form.submitLabel"
      :fallback="builtIn('submit')"
      @change="controller.write({ submitLabel: $event })"
    />
    <FormLocalizedText
      :id="`${idPrefix}-success`"
      :editing="editing"
      :label="label('successMessage')"
      :text="form.successMessage"
      :fallback="builtIn('success')"
      multiline
      @change="controller.write({ successMessage: $event })"
    />
    <FormSettingSwitch
      :id="`${idPrefix}-another`"
      :label="label('allowAnother')"
      :checked="form.allowAnotherResponse !== false"
      @change="controller.update({ allowAnotherResponse: $event })"
    />
    <FormSettingText
      :id="`${idPrefix}-redirect`"
      :label="label('redirectUrl')"
      :value="form.redirectUrl ?? ''"
      :hint="label('redirectHint')"
      type="url"
      @commit="controller.update({ redirectUrl: $event })"
    />
    <FormLocalizedText
      :id="`${idPrefix}-closed`"
      :editing="editing"
      :label="label('closedMessage')"
      :text="form.closedMessage"
      :fallback="builtIn('closed')"
      multiline
      @change="controller.write({ closedMessage: $event })"
    />
  </section>
  <section class="yayaw-form-builder-section" :aria-labelledby="`${idPrefix}-view`">
    <h3 :id="`${idPrefix}-view`" class="yayaw-form-builder-section-title">{{ label("inTheView") }}</h3>
    <FormSettingSwitch
      :id="`${idPrefix}-edit-button`"
      :label="label('editButtonSetting')"
      :checked="form.editButton !== false"
      @change="controller.update({ editButton: $event })"
    />
    <p class="yayaw-form-settings-note">{{ label("editButtonHint") }}</p>
  </section>
  <div class="yayaw-form-builder-reset">
    <button type="button" class="yayaw-button yayaw-button-outline yayaw-form-settings-add" @click="controller.reset()">
      {{ label("reset") }}
    </button>
    <p class="yayaw-form-settings-note">{{ label("resetHint") }}</p>
  </div>
</template>
