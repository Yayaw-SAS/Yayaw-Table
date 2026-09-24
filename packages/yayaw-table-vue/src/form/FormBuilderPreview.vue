<script setup lang="ts">
/**
 * The builder's center: the form as people will see it, in the language
 * being edited and the chosen layout. Answers are never sent; "Show as
 * closed" previews the closed message.
 */
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { computed, nextTick, ref, useId, watch } from "vue";
import type { FormBuilderState } from "../form-builder";
import { formLanguageName } from "../form-text";
import type { FormColumn, FormLabelKey, FormTranslate } from "../form-view";
import YayawTableForm from "./YayawTableForm.vue";

const props = defineProps<{
  columns: readonly FormColumn[];
  state: FormBuilderState;
  headingId: string;
  translate?: FormTranslate;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();

const id = `yayaw-form-builder-preview-${useId()}`;
const closed = ref(false);
const body = ref<HTMLElement>();
const layout = computed(() =>
  props.label(props.state.layout === "steps" ? "layoutSteps" : "layoutPage")
);
/** The preview answers without sending anything. */
const previewSubmit = () => ({ ok: true as const });

/** The rendered item of the selected entry, outlined and scrolled into view. */
const target = (container: HTMLElement): HTMLElement | null => {
  const selection = props.state.selection;
  switch (selection.kind) {
    case "question":
      return container.querySelector(`[data-form-question="${CSS.escape(selection.entry.id)}"]`);
    case "consent":
      return container.querySelector(`[data-form-consent="${CSS.escape(selection.entry.id)}"]`);
    case "section":
      return container.querySelector(`[data-form-section="${CSS.escape(selection.entry.id)}"]`);
    default:
      return null;
  }
};
let highlighted: HTMLElement | null = null;
watch(
  () => props.state,
  async () => {
    await nextTick();
    highlighted?.removeAttribute("data-builder-selected");
    highlighted = body.value ? target(body.value) : null;
    if (highlighted) {
      highlighted.setAttribute("data-builder-selected", "");
      highlighted.scrollIntoView?.({ block: "nearest" });
    }
  },
  { immediate: true, flush: "post" }
);
</script>

<template>
  <section class="yayaw-form-builder-preview" :aria-labelledby="headingId" data-form-builder-preview>
    <div class="yayaw-form-builder-pane-header yayaw-form-builder-preview-header">
      <h2 :id="headingId" class="yayaw-form-builder-pane-title">{{ label("builderPreview") }}</h2>
      <span class="yayaw-form-builder-subtitle" data-form-builder-preview-state>
        {{ formLanguageName(state.locale) }} · {{ layout }}
      </span>
      <div class="yayaw-form-builder-closed">
        <label :id="`${id}-closed-label`" class="yayaw-form-builder-subtitle" :for="`${id}-closed`">{{ label("builderShowClosed") }}</label>
        <SwitchRoot
          :id="`${id}-closed`"
          class="yayaw-switch-root"
          data-size="sm"
          :model-value="closed"
          :aria-labelledby="`${id}-closed-label`"
          @update:model-value="closed = $event === true"
        >
          <SwitchThumb class="yayaw-switch-thumb" />
        </SwitchRoot>
      </div>
    </div>
    <div ref="body" class="yayaw-form-builder-preview-body">
      <div class="yayaw-form-builder-preview-inner">
        <slot name="language" />
        <p class="yayaw-form-settings-note">{{ label("builderPreviewNote") }}</p>
        <YayawTableForm
          :columns="columns"
          :form="state.form"
          :locale="state.locale"
          :closed="closed"
          :translate="translate"
          :on-submit="previewSubmit"
        />
      </div>
    </div>
  </section>
</template>
