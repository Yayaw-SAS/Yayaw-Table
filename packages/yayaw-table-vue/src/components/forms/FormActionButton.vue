<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { formActionFlag } from "../../form-layout";
import type { FormAction, FormBlockContext } from "../../types";

const props = defineProps<{ action: FormAction; context: FormBlockContext }>();
const pending = ref(false);
const error = ref<string>();
let request: AbortController | undefined;
const blocked = () =>
  props.context.disabled ||
  formActionFlag(props.action.disabled, props.context);
const hidden = () => formActionFlag(props.action.hidden, props.context);
watch([blocked, hidden], ([disabled, invisible]) => {
  if (disabled || invisible) {
    request?.abort();
    request = undefined;
    pending.value = false;
  }
});
onBeforeUnmount(() => request?.abort());
watch(
  [
    () => props.context.row,
    () => props.context.formType,
    () => props.context.mode,
  ],
  () => {
    request?.abort();
    request = undefined;
    pending.value = false;
    error.value = undefined;
  }
);
const run = async (): Promise<void> => {
  if (blocked() || hidden() || (request && !request.signal.aborted)) return;
  const controller = new AbortController();
  request = controller;
  pending.value = true;
  error.value = undefined;
  const context: FormBlockContext = {
    ...props.context,
    get values() {
      return props.context.values;
    },
    setFieldValue: (name, value) => {
      if (!controller.signal.aborted && !props.context.disabled)
        props.context.setFieldValue(name, value);
    },
    submit: async () => {
      if (!controller.signal.aborted && !props.context.disabled)
        await props.context.submit();
    },
  };
  try {
    if (props.action.validate && !(await context.validate())) return;
    if (!controller.signal.aborted)
      await props.action.onClick(context, controller.signal);
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    if (!controller.signal.aborted) {
      request = undefined;
      pending.value = false;
    }
  }
};
</script>

<template>
  <div v-if="!hidden()" class="yayaw-form-action">
    <button
      type="button"
      class="yayaw-button"
      :class="{
        'yayaw-button-outline': !action.variant || action.variant === 'outline',
        'yayaw-button-secondary': action.variant === 'secondary',
        'yayaw-button-danger': action.variant === 'destructive',
      }"
      :aria-busy="pending"
      :disabled="blocked() || pending"
      @click="run"
    >
      {{
        action.labelKey
          ? context.translations?.[action.labelKey] ?? action.label
          : action.label
      }}
    </button>
    <p v-if="error" class="yayaw-error" role="alert">{{ error }}</p>
  </div>
</template>
