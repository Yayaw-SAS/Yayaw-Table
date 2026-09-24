<script setup lang="ts">
import { computed, ref } from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import { formLanguage, formLocaleMatch } from "../form-text";
import {
  type FormColumn,
  type FormLabelKey,
  formLabel,
  formViewLocales,
  mergeFormSettings,
  publicFormSnapshot,
} from "../form-view";
import FormLanguageSwitch from "./FormLanguageSwitch.vue";
import FormShare from "./FormShare.vue";
import YayawTableForm from "./YayawTableForm.vue";

/**
 * The Form display mode: the view's form, creating records in this table. A
 * form written in several languages can be previewed in each of them.
 */
const props = defineProps<{ context: DisplayModeRenderContext }>();
const columns = computed(
  () => props.context.columns as unknown as readonly FormColumn[]
);
// Tags look like the table's: its colored-tags setting applies to the form.
const formColumns = computed(() =>
  columns.value.map((column) => ({
    ...column,
    coloredTags: column.coloredTags ?? props.context.coloredTags,
  }))
);
const form = computed(() =>
  mergeFormSettings(props.context.defaults, props.context.settings)
);
const translate = (key: FormLabelKey, fallback: string): string =>
  props.context.translate(`form.${key}`, fallback);
const snapshot = () => publicFormSnapshot(form.value, formColumns.value);
const languages = computed(() =>
  formViewLocales(
    props.context.defaults,
    props.context.settings,
    formLanguage(props.context.locale) || "en"
  )
);
const preview = ref<string>();
const previewed = computed(() =>
  preview.value && languages.value.includes(preview.value)
    ? preview.value
    : undefined
);
const shown = computed(
  () =>
    previewed.value ??
    formLocaleMatch(languages.value, props.context.locale) ??
    languages.value[0] ??
    props.context.locale
);
const multilingual = computed(() => languages.value.length > 1);
</script>

<template>
  <div class="yayaw-form-view" data-form-view>
    <div v-if="context.formLinks || multilingual" class="yayaw-form-toolbar" data-form-toolbar>
      <FormLanguageSwitch
        v-if="multilingual"
        :label="formLabel('previewLanguage', context.locale, translate)"
        :languages="languages"
        :value="shown"
        @change="preview = $event"
      />
      <div v-if="context.formLinks" class="yayaw-form-toolbar-end">
        <FormShare
          :form-links="context.formLinks"
          :view-id="context.viewId"
          :snapshot="snapshot"
          :locale="context.locale"
          :translate="translate"
        />
      </div>
    </div>
    <div class="yayaw-form-canvas">
      <YayawTableForm
        :key="context.viewId ?? 'form'"
        :columns="formColumns"
        :form="form"
        :locale="previewed ?? context.locale"
        :translate="translate"
        :on-submit="(values) => context.createRecord(values)"
      />
    </div>
  </div>
</template>
