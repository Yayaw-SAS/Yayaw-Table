<script setup lang="ts">
import { computed } from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import {
  type FormColumn,
  type FormLabelKey,
  mergeFormSettings,
  publicFormSnapshot,
} from "../form-view";
import FormShare from "./FormShare.vue";
import YayawTableForm from "./YayawTableForm.vue";

/** The Form display mode: the view's form, creating records in this table. */
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
</script>

<template>
  <div class="yayaw-form-view" data-form-view>
    <div v-if="context.formLinks" class="yayaw-form-toolbar" data-form-toolbar>
      <FormShare
        :form-links="context.formLinks"
        :view-id="context.viewId"
        :snapshot="snapshot"
        :locale="context.locale"
        :translate="translate"
      />
    </div>
    <div class="yayaw-form-canvas">
      <YayawTableForm
        :key="context.viewId ?? 'form'"
        :columns="formColumns"
        :form="form"
        :locale="context.locale"
        :translate="translate"
        :on-submit="(values) => context.createRecord(values)"
      />
    </div>
  </div>
</template>
