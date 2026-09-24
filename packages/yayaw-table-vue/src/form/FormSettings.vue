<script setup lang="ts">
/**
 * View → Form settings: what the form asks (questions, layout, languages)
 * and "Edit form", which closes the menu and opens the form builder over the
 * Form view, where the form is edited. Reset goes back to the table's form.
 */
import { Pencil } from "lucide-vue-next";
import { computed, inject } from "vue";
import { settingsMenuCloseKey } from "../components/toolbar/settings-navigation";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import { formBuilderSummary, formBuilderSummaryLines } from "../form-builder";
import {
  type FormColumn,
  type FormLabelKey,
  type FormTranslate,
  formLabel,
  normalizeFormViewConfig,
  withFormFields,
} from "../form-view";
import { useFormBuilderRequests } from "./form-builder-request";

const props = defineProps<{ context: DisplayModeSettingsContext }>();
const translate: FormTranslate = (name, fallback) =>
  props.context.translate(`form.${name}`, fallback);
const label = (key: FormLabelKey): string =>
  formLabel(key, props.context.locale, translate);
const columns = computed(() =>
  withFormFields(
    props.context.columns as unknown as readonly FormColumn[],
    props.context.formFields
  )
);
const summary = computed(() =>
  formBuilderSummary(
    columns.value,
    props.context.defaults,
    props.context.settings,
    props.context.locale
  )
);
const lines = computed(() =>
  formBuilderSummaryLines(summary.value, props.context.locale, translate)
);
const customized = computed(() =>
  Boolean(normalizeFormViewConfig(props.context.settings))
);
const closeMenu = inject(settingsMenuCloseKey, undefined);
const requests = useFormBuilderRequests();
const edit = (): void => {
  closeMenu?.();
  requests.value += 1;
};
</script>

<template>
  <div class="yayaw-form-settings" data-form-settings>
    <div class="yayaw-form-summary" data-form-summary>
      <p v-if="summary.title" class="yayaw-form-summary-title">{{ summary.title }}</p>
      <p v-for="line in lines" :key="line" class="yayaw-form-summary-line">{{ line }}</p>
    </div>
    <button type="button" class="yayaw-button yayaw-form-settings-edit" data-form-settings-edit @click="edit">
      <Pencil :size="16" aria-hidden="true" />{{ label("editForm") }}
    </button>
    <p class="yayaw-form-settings-note">{{ label("summaryHint") }}</p>
    <button
      type="button"
      class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
      :disabled="!customized"
      @click="context.updateSettings(undefined)"
    >
      {{ label("reset") }}
    </button>
  </div>
</template>
