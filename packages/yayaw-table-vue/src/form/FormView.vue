<script setup lang="ts">
import { Pencil } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import { formLanguage, formLocaleMatch } from "../form-text";
import {
  type FormColumn,
  type FormLabelKey,
  type FormViewSettings,
  formLabel,
  formViewLocales,
  mergeFormSettings,
  publicFormSnapshot,
  withFormFields,
} from "../form-view";
import FormBuilderDialog from "./FormBuilderDialog.vue";
import FormLanguageSwitch from "./FormLanguageSwitch.vue";
import FormShare from "./FormShare.vue";
import { useFormBuilderRequests } from "./form-builder-request";
import YayawTableForm from "./YayawTableForm.vue";

/**
 * The Form display mode: the view's form, creating records in this table,
 * with "Edit form" (the form builder) and "Share form" above it. A form
 * written in several languages can be previewed in each of them.
 */
const props = defineProps<{ context: DisplayModeRenderContext }>();
const columns = computed(
  () => props.context.columns as unknown as readonly FormColumn[]
);
// Tags look like the table's: its colored-tags setting applies to the form.
// Columns the create form lacks are not asked.
const formColumns = computed(() =>
  withFormFields(
    columns.value.map((column) => ({
      ...column,
      coloredTags: column.coloredTags ?? props.context.coloredTags,
    })),
    props.context.formFields
  )
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
const editable = computed(() => form.value.editButton !== false);

// The form builder: "Edit form" here, or in View settings.
const building = ref(false);
const editButton = ref<HTMLButtonElement>();
const requests = useFormBuilderRequests();
watch(requests, () => {
  building.value = true;
});
const share = computed(() =>
  props.context.formLinks
    ? {
        formLinks: props.context.formLinks,
        viewId: props.context.viewId,
        snapshot,
      }
    : undefined
);
const save = (next: FormViewSettings | undefined): void =>
  props.context.updateSettings(next as Record<string, unknown> | undefined);
</script>

<template>
  <div class="yayaw-form-view" data-form-view>
    <div v-if="context.formLinks || multilingual || editable" class="yayaw-form-toolbar" data-form-toolbar>
      <FormLanguageSwitch
        v-if="multilingual"
        :label="formLabel('previewLanguage', context.locale, translate)"
        :languages="languages"
        :value="shown"
        @change="preview = $event"
      />
      <div class="yayaw-form-toolbar-end">
        <button
          v-if="editable"
          ref="editButton"
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-form-edit-trigger"
          data-form-edit
          @click="building = true"
        >
          <Pencil :size="16" aria-hidden="true" />{{ formLabel("editForm", context.locale, translate) }}
        </button>
        <FormShare
          v-if="context.formLinks"
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
    <FormBuilderDialog
      :open="building"
      :columns="formColumns"
      :defaults="context.defaults"
      :settings="context.settings"
      :locale="context.locale"
      :translate="translate"
      :share="share"
      :final-focus="editButton"
      @update:open="building = $event"
      @save="save"
    />
  </div>
</template>
