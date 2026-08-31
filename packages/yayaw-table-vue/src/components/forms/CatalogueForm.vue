<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import type {
  FormConfig,
  FormFieldContext,
  FormFieldDefinition,
  FormSectionDefinition,
  ColumnType,
  FormFieldType,
  TableRecord,
} from "../../types";
import DynamicField from "./DynamicField.vue";

const context = useTableContext();
const values = ref<TableRecord>({});
const errors = ref<Record<string, string>>({});
const submitting = ref(false);
const formType = computed(
  () => context.form.value.formType ?? context.config.id
);
const fieldTypeByColumnType: Partial<Record<ColumnType, FormFieldType>> = {
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
    .map(
      (column) =>
        ({
          name: column.accessorKey ?? column.id,
          label: column.header,
          type: fieldTypeByColumnType[column.type ?? "text"] ?? "text",
          options: column.options,
        }) as FormFieldDefinition
    );
const formContext = computed<FormFieldContext>(() => ({
  formType: formType.value,
  initialData: context.form.value.row,
  mode: context.form.value.mode,
  row: context.form.value.row,
  tableId: context.config.id,
  tableType: context.config.id,
  values: values.value,
}));
const configured = computed(() =>
  context.getFormConfig?.(formType.value, formContext.value)
);
const config = computed<FormConfig>(
  () =>
    configured.value ?? {
      id: formType.value,
      fields: generatedFields(),
      presentation: context.config.form?.presentation ?? "drawer",
      width: context.config.form?.width,
    }
);
const title = computed(() =>
  typeof config.value.title === "function"
    ? config.value.title(context.form.value.mode, context.form.value.row)
    : (config.value.title ??
      (context.form.value.mode === "create"
        ? String(context.translations.value.create)
        : String(context.translations.value.edit)))
);
const sections = computed<FormSectionDefinition[]>(() =>
  config.value.sections?.length
    ? config.value.sections
    : [
        {
          id: "default",
          fields: config.value.fields.map((field) => field.name),
        },
      ]
);
const fieldFor = (name: string): FormFieldDefinition | undefined =>
  config.value.fields.find((field) => field.name === name);
const close = (): void => {
  if (!submitting.value) {
    context.form.value = { ...context.form.value, open: false };
  }
};
const isMissing = (value: unknown): boolean =>
  value === "" ||
  value === null ||
  value === undefined ||
  (Array.isArray(value) && value.length === 0);
const validateField = (
  field: FormFieldDefinition,
  value: unknown
): string | undefined => {
  if (field.required && isMissing(value)) {
    return `${field.label} is required`;
  }
  const fieldResult = field.schema?.safeParse(value);
  if (fieldResult && !fieldResult.success) {
    return fieldResult.error.issues[0]?.message ?? `Invalid ${field.label}`;
  }
  if (field.type !== "collection" || !Array.isArray(value)) {
    return undefined;
  }
  const collectionErrors = [
    ...(field.validateItems?.(value as TableRecord[]) ?? []),
    ...value.flatMap(
      (item, index) =>
        field.validateItem?.(item as TableRecord, index) ?? []
    ),
  ];
  return collectionErrors.length ? collectionErrors.join("; ") : undefined;
};
const validate = (): boolean => {
  errors.value = {};
  for (const field of config.value.fields) {
    const value = values.value[field.name];
    const fieldError = validateField(field, value);
    if (fieldError) {
      errors.value[field.name] = fieldError;
    }
  }
  if (config.value.schema) {
    const result = config.value.schema.safeParse(values.value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.value[String(issue.path[0] ?? "form")] = issue.message;
      }
    }
  }
  return Object.keys(errors.value).length === 0;
};
const submit = async (): Promise<void> => {
  if (!validate()) {
    return;
  }
  submitting.value = true;
  try {
    const payload = config.value.transform
      ? await config.value.transform(values.value, formContext.value)
      : values.value;
    const result =
      context.form.value.mode === "create"
        ? await context.actions.value?.create?.(payload)
        : await context.actions.value?.update?.(
            context.getRowId(context.form.value.row ?? {}),
            payload
          );
    if (!result?.success) {
      throw new Error(result?.error ?? "The form could not be saved");
    }
    context.status.value = {
      type: "success",
      message:
        context.form.value.mode === "create" ? "Row created" : "Row updated",
    };
    context.form.value = { ...context.form.value, open: false };
    await context.refresh();
  } catch (cause) {
    errors.value.form = cause instanceof Error ? cause.message : String(cause);
  } finally {
    submitting.value = false;
  }
};
const defaultForField = (field: FormFieldDefinition): unknown => {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.type === "collection" || field.type === "multiSelect") {
    return [];
  }
  if (field.type === "switch" || field.type === "checkbox") {
    return false;
  }
  return "";
};
onMounted(() => {
  const generatedDefaults = Object.fromEntries(
    config.value.fields.map((field) => [field.name, defaultForField(field)])
  );
  values.value = {
    ...generatedDefaults,
    ...config.value.defaultValues,
    ...context.form.value.row,
  };
});
</script>

<template>
  <div class="yayaw-dialog-backdrop" @mousedown.self="close">
    <section class="yayaw-form-surface" :data-presentation="config.presentation ?? 'drawer'" :style="{ width: config.width }" role="dialog" aria-modal="true" :aria-label="title">
      <header class="yayaw-form-header">
        <div>
          <h3>{{ title }}</h3>
          <p v-if="config.description">{{ config.description }}</p>
        </div>
        <button type="button" class="yayaw-icon-button" aria-label="Close" @click="close">×</button>
      </header>
      <form class="yayaw-form" @submit.prevent="submit">
        <p v-if="errors.form" class="yayaw-error" role="alert">{{ errors.form }}</p>
        <section v-for="section in sections" :key="section.id" class="yayaw-form-section">
          <header v-if="section.title || section.description">
            <h4 v-if="section.title">{{ section.title }}</h4>
            <p v-if="section.description">{{ section.description }}</p>
          </header>
          <div class="yayaw-form-grid" :style="{ '--columns': section.columns ?? 1 }">
            <DynamicField
              v-for="fieldName in section.fields"
              :key="fieldName"
              :field="fieldFor(fieldName)!"
              :model-value="values[fieldName]"
              :context="formContext"
              :error="errors[fieldName]"
              @update:model-value="values[fieldName] = $event"
            />
          </div>
        </section>
        <footer class="yayaw-form-footer">
          <button type="button" class="yayaw-button yayaw-button-outline" :disabled="submitting" @click="close">{{ config.cancelLabel ?? 'Cancel' }}</button>
          <button type="submit" class="yayaw-button" :disabled="submitting">{{ submitting ? 'Saving…' : config.submitLabel ?? 'Save' }}</button>
        </footer>
      </form>
    </section>
  </div>
</template>
