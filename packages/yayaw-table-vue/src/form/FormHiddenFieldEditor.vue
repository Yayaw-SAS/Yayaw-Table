<script lang="ts">
import type { FormHiddenSourceType, FormLabelKey } from "../form-view";

/** Labels of the hidden field sources. */
export const FORM_HIDDEN_SOURCE_LABELS: Record<FormHiddenSourceType, FormLabelKey> = {
  urlParam: "sourceUrlParam",
  pageUrl: "sourcePageUrl",
  referrer: "sourceReferrer",
  locale: "sourceLocale",
  static: "sourceStatic",
};
</script>

<script setup lang="ts">
/**
 * A hidden field's source (URL parameter, page, referrer, language or fixed
 * text) and where its value is saved: a column, or the response details.
 */
import { computed } from "vue";
import type { FormColumn, FormHiddenField, FormHiddenSource } from "../form-view";
import FormRuleSelect from "./FormRuleSelect.vue";
import FormSettingText from "./FormSettingText.vue";

/** "Save in" choice of a value kept in the response details. */
const DETAILS = "__details";

const props = defineProps<{
  field: FormHiddenField;
  /** Columns the field may write (`formHiddenFieldColumns`). */
  columns: readonly FormColumn[];
  /** Prefix of the editor's control ids. */
  idPrefix: string;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{
  change: [patch: { source?: FormHiddenSource; columnId?: string }];
}>();
const paramName = computed(() =>
  props.field.source.type === "urlParam" ? props.field.source.name : ""
);
const staticValue = computed(() =>
  props.field.source.type === "static" ? props.field.source.value : ""
);
const sourceOptions = computed(() =>
  Object.entries(FORM_HIDDEN_SOURCE_LABELS).map(([value, key]) => ({
    value,
    label: props.label(key),
  }))
);
const columnOptions = computed(() => [
  { value: DETAILS, label: props.label("responseDetails") },
  ...props.columns.map((column) => ({ value: column.id, label: column.header })),
]);
/** A source of another type, keeping what it can of the current one. */
const sourceOfType = (type: string): FormHiddenSource => {
  switch (type as FormHiddenSourceType) {
    case "urlParam":
      return { type: "urlParam", name: "utm_source" };
    case "static":
      return { type: "static", value: props.field.id };
    case "pageUrl":
      return { type: "pageUrl" };
    case "referrer":
      return { type: "referrer" };
    default:
      return { type: "locale" };
  }
};
</script>

<template>
  <div class="yayaw-form-setting">
    <span class="yayaw-form-setting-label" aria-hidden="true">{{ label("hiddenSource") }}</span>
    <FormRuleSelect
      :label="label('hiddenSource')"
      :value="field.source.type"
      :options="sourceOptions"
      @change="emit('change', { source: sourceOfType($event) })"
    />
  </div>
  <FormSettingText
    v-if="field.source.type === 'urlParam'"
    :id="`${idPrefix}-param`"
    :label="label('paramName')"
    :value="paramName"
    @commit="emit('change', { source: { type: 'urlParam', name: $event } })"
  />
  <FormSettingText
    v-if="field.source.type === 'static'"
    :id="`${idPrefix}-static`"
    :label="label('staticValue')"
    :value="staticValue"
    @commit="emit('change', { source: { type: 'static', value: $event } })"
  />
  <div class="yayaw-form-setting">
    <span class="yayaw-form-setting-label" aria-hidden="true">{{ label("saveIn") }}</span>
    <FormRuleSelect
      :label="label('saveIn')"
      :value="field.columnId ?? DETAILS"
      :options="columnOptions"
      @change="emit('change', { columnId: $event === DETAILS ? undefined : $event })"
    />
  </div>
</template>
