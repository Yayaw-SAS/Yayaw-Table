<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useTableContext } from "../../context";
import {
  bulkCompletion,
  bulkFieldEditable,
  bulkFormConfig,
  bulkFormValues,
} from "../../bulk-form";
import {
  cloneFormValue,
  formSubmissionValues,
  initialFormValues,
  resolveFormSections,
  translateFormConfig,
  validateForm,
} from "../../form-runtime";
import type {
  ColumnType,
  FormConfig,
  FormFieldContext,
  FormFieldDefinition,
  FormFieldType,
  TableRecord,
} from "../../types";
import DynamicField from "./DynamicField.vue";
import FormDialog from "./FormDialog.vue";

const context = useTableContext();
const values = ref<TableRecord>({});
const initial = ref<TableRecord>({});
const errors = ref<Record<string, string>>({});
const touched = ref<Record<string, boolean>>({});
const applied = ref<string[]>([]);
const isBulk = computed(() => Boolean(context.form.value.bulk));
const label = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);
const submitting = ref(false);
const loading = ref(false);
const loadError = ref<string>();
let validationVersion = 0;
let initializer: AbortController | undefined;
const formType = computed(
  () =>
    context.form.value.formType ??
    context.formType ??
    context.tableType ??
    context.config.id
);
const fieldTypes: Partial<Record<ColumnType, FormFieldType>> = {
  boolean: "switch",
  date: "date",
  multiSelect: "multiSelect",
  number: "number",
  select: "select",
  url: "url",
};
const generatedFields = (): FormFieldDefinition[] =>
  context.config.columns.definitions
    .filter(
      (column) =>
        !["actions", "select"].includes(column.id) && column.type !== "actions"
    )
    .map((column) => ({
      name: column.accessorKey ?? column.id,
      label: column.header,
      type: fieldTypes[column.type ?? "text"] ?? "text",
      options: column.options,
    }));
const setFieldValue = (name: string, value: unknown): void => {
  if (submitting.value || loading.value) return;
  values.value = { ...values.value, [name]: value };
  validationVersion += 1;
  if (touched.value[name]) void touchField(name);
};
const formContext = computed<FormFieldContext>(() => ({
  bulkEdit: context.form.value.bulk
    ? {
        ids: context.form.value.bulk.ids,
        rows: context.form.value.bulk.rows,
        fields: applied.value,
      }
    : undefined,
  formType: formType.value,
  initialData: initial.value,
  locale: context.locale,
  mode: context.form.value.mode,
  row: context.form.value.row,
  tableId: context.config.id,
  tableType: context.tableType ?? context.config.id,
  values: values.value,
  setFieldValue,
  touchField: (name) => {
    void touchField(name);
  },
  translations: context.translations.value,
}));
const config = computed<FormConfig>(() =>
  translateFormConfig(
    context.getFormConfig?.(formType.value, formContext.value) ?? {
      id: formType.value,
      fields: generatedFields(),
      presentation: context.config.form?.presentation ?? "drawer",
      width: context.config.form?.width,
    }
  )
);
const title = computed(() =>
  isBulk.value
    ? label("bulkEdit", "Bulk edit")
    : typeof config.value.title === "function"
    ? config.value.title(context.form.value.mode, context.form.value.row)
    : config.value.title ??
      String(
        context.translations.value[
          context.form.value.mode === "create" ? "create" : "edit"
        ]
      )
);
const sections = computed(() => resolveFormSections(config.value));
const fieldFor = (name: string): FormFieldDefinition =>
  config.value.fields.find((field) => field.name === name)!;
const renderedField = (name: string): FormFieldDefinition =>
  isBulk.value
    ? { ...fieldFor(name), hidden: false, disabled: false }
    : fieldFor(name);
const submissionConfig = (): FormConfig =>
  isBulk.value ? bulkFormConfig(config.value, formContext.value) : config.value;
const submissionValues = (current: FormConfig): TableRecord =>
  isBulk.value
    ? bulkFormValues(current, values.value)
    : cloneFormValue(values.value);
const bulkCanSave = (fields: FormFieldDefinition[]): boolean => {
  const bulk = context.form.value.bulk;
  if (!bulk) return true;
  return context.config.table.allowBulkEdit &&
    bulk.rows.every(row => context.config.table.canEditRow?.(row) !== false) &&
    fields.every(field => {
      const latest = config.value.fields.find(candidate => candidate.name === field.name);
      return Boolean(latest && bulkFieldEditable(latest, formContext.value));
    });
};
const close = (): void => {
  if (!submitting.value)
    context.form.value = { ...context.form.value, open: false };
};
const touchField = async (name: string): Promise<void> => {
  touched.value[name] = true;
  const version = ++validationVersion;
  try {
    const current = submissionConfig();
    const result = await validateForm(
      current,
      submissionValues(current),
      formContext.value
    );
    if (version !== validationVersion) return;
    errors.value = Object.fromEntries(
      Object.entries(result.errors).filter(
        ([path]) => touched.value[path.split(".")[0] ?? path]
      )
    );
  } catch (cause) {
    if (version === validationVersion)
      errors.value[name] =
        cause instanceof Error ? cause.message : String(cause);
  }
};
const initialize = async (): Promise<void> => {
  initializer?.abort();
  const controller = new AbortController();
  initializer = controller;
  validationVersion += 1;
  errors.value = {};
  touched.value = {};
  applied.value = [];
  loadError.value = undefined;
  const selected = context.form.value;
  values.value = initialFormValues(config.value, selected.row);
  initial.value = cloneFormValue(values.value);
  loading.value = !selected.bulk && Boolean(config.value.loadInitialValues);
  try {
    if (!selected.bulk && config.value.loadInitialValues) {
      const loaded = await config.value.loadInitialValues(
        selected.row,
        formContext.value,
        controller.signal
      );
      if (controller.signal.aborted) return;
      values.value = initialFormValues(config.value, {
        ...selected.row,
        ...loaded,
      });
      initial.value = cloneFormValue(values.value);
    }
  } catch (cause) {
    if (!controller.signal.aborted)
      loadError.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
};
watch(
  () => [
    context.form.value.mode,
    context.form.value.formType,
    context.form.value.row,
  ],
  initialize,
  { immediate: true }
);
onBeforeUnmount(() => {
  initializer?.abort();
  validationVersion += 1;
});

const submit = async (): Promise<void> => {
  if (submitting.value || loading.value || loadError.value) return;
  submitting.value = true;
  validationVersion += 1;
  const selected = context.form.value;
  const currentConfig = submissionConfig();
  const currentContext = {
    ...formContext.value,
    values: cloneFormValue(values.value),
  };
  try {
    if (!bulkCanSave(currentConfig.fields)) {
      errors.value.form = label(
        "bulkEditDenied",
        "These rows can no longer be edited."
      );
      return;
    }
    if (selected.bulk && !currentConfig.fields.length) {
      errors.value.form = label(
        "bulkChooseFields",
        "Choose at least one field to apply."
      );
      return;
    }
    const validated = await validateForm(
      currentConfig,
      submissionValues(currentConfig),
      currentContext
    );
    if (context.form.value !== selected) return;
    errors.value = validated.errors;
    if (Object.keys(validated.errors).length) return;
    const prepared = formSubmissionValues(
      currentConfig,
      validated.values,
      initial.value,
      currentContext
    );
    const payload = currentConfig.transform
      ? await currentConfig.transform(prepared, currentContext)
      : prepared;
    if (context.form.value !== selected) return;
    if (!bulkCanSave(currentConfig.fields)) {
      errors.value.form = label(
        "bulkEditDenied",
        "These rows can no longer be edited."
      );
      return;
    }
    const result = selected.bulk
      ? await context.actions.value?.bulkUpdate?.(
          [...selected.bulk.ids],
          payload
        )
      : selected.mode === "create"
      ? await context.actions.value?.create?.(payload)
      : await context.actions.value?.update?.(
          context.getRowId(selected.row ?? {}),
          payload
        );
    if (context.form.value !== selected) return;
    let completed: string[] = [];
    if (selected.bulk && result) {
      const bulk = selected.bulk;
      const progress = bulkCompletion(bulk.ids, result);
      completed = progress.completed;
      bulk.completed(completed);
      // Keep the draft but retry only failed targets after partial completion.
      bulk.rows = bulk.rows.filter((_row, index) =>
        progress.remaining.includes(bulk.ids[index] ?? "")
      );
      bulk.ids = progress.remaining;
    }
    if (!result?.success) {
      errors.value = {
        ...result?.fieldErrors,
        form: result?.error ?? "The form could not be saved",
      };
      if (completed.length) await context.refresh();
      return;
    }
    context.form.value = { ...selected, open: false };
    context.status.value = {
      type: "success",
      message: selected.bulk
        ? label("bulkUpdated", "Selected rows updated")
        : selected.mode === "create"
        ? label("rowCreated", "Row created")
        : label("rowUpdated", "Row updated"),
    };
    await context.refresh();
  } catch (cause) {
    if (context.form.value === selected)
      errors.value.form =
        cause instanceof Error ? cause.message : String(cause);
    else if (!context.form.value.open)
      context.status.value = {
        type: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      };
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <FormDialog
    :open="context.form.value.open"
    :title="title"
    :description="
      isBulk
        ? label(
            'bulkEditDescription',
            'Only checked fields are applied to the selected rows. Unchecked fields stay unchanged.'
          )
        : config.description
    "
    :presentation="config.presentation"
    :width="config.width"
    :busy="submitting"
    :close-label="label('close', 'Close')"
    :return-focus="context.form.value.returnFocus"
    @close="close"
  >
    <form class="yayaw-form" @submit.prevent="submit">
      <p v-if="isBulk" class="yayaw-bulk-selection-count">
        {{ context.form.value.bulk?.ids.length }}
        {{ label("selected", "selected") }}
      </p>
      <p v-if="loading" role="status">{{ label("loading", "Loading…") }}</p>
      <p v-if="loadError || errors.form" class="yayaw-error" role="alert">
        {{ loadError ?? errors.form }}
      </p>
      <button
        v-if="loadError"
        type="button"
        class="yayaw-button"
        @click="initialize"
      >
        {{ label("retry", "Retry") }}
      </button>
      <fieldset
        class="yayaw-form-fields"
        :disabled="submitting || loading || Boolean(loadError)"
      >
        <section
          v-for="section in sections"
          :key="section.id"
          class="yayaw-form-section"
        >
          <header v-if="section.title || section.description">
            <h4 v-if="section.title">{{ section.title }}</h4>
            <p v-if="section.description">{{ section.description }}</p>
          </header>
          <div
            class="yayaw-form-grid"
            :style="{ '--columns': section.columns ?? 1 }"
          >
            <template v-for="name in section.fields" :key="name">
              <div
                v-if="isBulk && bulkFieldEditable(fieldFor(name), formContext)"
                class="yayaw-bulk-field"
                :data-bulk-field="name"
              >
                <label class="yayaw-bulk-field-toggle">
                  <input
                    v-model="applied"
                    type="checkbox"
                    :value="name"
                    class="yayaw-checkbox"
                  />
                  {{ label("bulkApplyField", "Apply") }}
                  {{ fieldFor(name).label }}
                </label>
                <DynamicField
                  v-if="applied.includes(name)"
                  :field="renderedField(name)"
                  :model-value="values[name]"
                  :context="formContext"
                  :error="errors[name]"
                  :errors="errors"
                  :touched="touched[name]"
                  @update:model-value="setFieldValue(name, $event)"
                />
              </div>
              <DynamicField
                v-else-if="!isBulk"
                :field="fieldFor(name)"
                :model-value="values[name]"
                :context="formContext"
                :error="errors[name]"
                :errors="errors"
                :touched="touched[name]"
                @update:model-value="setFieldValue(name, $event)"
              />
            </template>
          </div>
        </section>
      </fieldset>
      <footer class="yayaw-form-footer">
        <button
          type="button"
          class="yayaw-button yayaw-button-outline"
          :disabled="submitting"
          @click="close"
        >
          {{ config.cancelLabel ?? "Cancel" }}
        </button>
        <button
          type="submit"
          class="yayaw-button"
          :disabled="submitting || loading || Boolean(loadError)"
        >
          {{ submitting ? "Saving…" : config.submitLabel ?? "Save" }}
        </button>
      </footer>
    </form>
  </FormDialog>
</template>
