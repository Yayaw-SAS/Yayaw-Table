<script lang="ts">
import type { FormLinkActions, PublicFormSnapshot } from "../form-view";

/** Publishing from the builder: the view's public link. */
export interface FormBuilderShare {
  formLinks: FormLinkActions;
  viewId: string | null;
  /** The saved form, as it would be published (unsaved changes are not). */
  snapshot: () => PublicFormSnapshot;
}
</script>

<script setup lang="ts">
/**
 * One opening of the form builder: a draft of the view's form (the builder's
 * controller), the top bar, the three panels (tabs on phones) and "Discard
 * your changes?".
 */
import { Settings2, X } from "lucide-vue-next";
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "reka-ui";
import {
  type CSSProperties,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  watch,
} from "vue";
import {
  FORM_BUILDER_FORM,
  FormBuilderController,
  type FormBuilderOptions,
  type FormBuilderTab,
} from "../form-builder";
import {
  type FormColumn,
  type FormLabelKey,
  type FormLayout,
  type FormTranslate,
  type FormViewSettings,
  formLabel,
} from "../form-view";
import FormBuilderOutline from "./FormBuilderOutline.vue";
import FormBuilderPreview from "./FormBuilderPreview.vue";
import FormBuilderProperties from "./FormBuilderProperties.vue";
import FormLanguageSwitch from "./FormLanguageSwitch.vue";
import FormShare from "./FormShare.vue";

const props = defineProps<{
  columns: readonly FormColumn[];
  /** The table's form settings (`table.form`). */
  defaults: unknown;
  /** The view's own form settings; the builder edits a copy. */
  settings: unknown;
  /** The table's language. */
  locale: string;
  translate?: FormTranslate;
  share?: FormBuilderShare;
  /** The table's theme tokens, for the portalled dialog. */
  theme: CSSProperties;
}>();
const emit = defineEmits<{
  close: [];
  save: [settings: FormViewSettings | undefined];
}>();

/** Phones and narrow windows show one panel at a time, in tabs. */
const COMPACT_QUERY = "(max-width: 1023px)";
const LAYOUTS: FormLayout[] = ["page", "steps"];
const TABS: { value: FormBuilderTab; key: FormLabelKey }[] = [
  { value: "outline", key: "questions" },
  { value: "preview", key: "builderPreview" },
  { value: "properties", key: "builderProperties" },
];

const options = (): FormBuilderOptions => ({
  columns: props.columns,
  defaults: props.defaults,
  settings: props.settings,
  locale: props.locale,
  translate: props.translate,
  onSave: (settings) => emit("save", settings),
  onClose: () => emit("close"),
});
const controller = new FormBuilderController(options());
const state = shallowRef(controller.getState());
const unsubscribe = controller.subscribe(() => {
  state.value = controller.getState();
});
// Fresh columns and labels; the draft is kept.
watch(
  () => [props.columns, props.defaults, props.locale, props.translate],
  () => controller.setOptions(options())
);

const media =
  typeof window === "undefined" ? undefined : window.matchMedia?.(COMPACT_QUERY);
const syncCompact = (): void => controller.setCompact(media?.matches ?? false);
// Phones open on the tabs directly.
syncCompact();
onMounted(() => media?.addEventListener("change", syncCompact));
onBeforeUnmount(() => {
  media?.removeEventListener("change", syncCompact);
  unsubscribe();
});

const id = `yayaw-form-builder-${useId()}`;
const layoutName = `${id}-layout`;
const label = (key: FormLabelKey, params?: Record<string, string>): string =>
  formLabel(key, props.locale, props.translate, params);

const onKeydown = (event: KeyboardEvent): void => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (state.value.dirty) controller.save();
  }
};
/** Escape asks before discarding unsaved changes; nested menus close first. */
const onEscape = (event: KeyboardEvent): void => {
  event.preventDefault();
  controller.requestClose();
};
const keepOpen = (event: Event): void => event.preventDefault();
/** The selected outline entry (the first tab on phones) takes the focus. */
const onOpenFocus = async (event: Event): Promise<void> => {
  event.preventDefault();
  await nextTick();
  document
    .getElementById(id)
    ?.querySelector<HTMLElement>(
      '[data-form-builder-entry][aria-current="true"], [role="tab"][aria-selected="true"]'
    )
    ?.focus();
};
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="yayaw-form-builder-backdrop" :style="theme" />
    <DialogContent
      :id="id"
      class="yayaw-form-builder"
      :data-compact="state.compact || undefined"
      :style="theme"
      data-form-builder
      @escape-key-down="onEscape"
      @pointer-down-outside="keepOpen"
      @interact-outside="keepOpen"
      @open-auto-focus="onOpenFocus"
      @close-auto-focus="keepOpen"
      @keydown="onKeydown"
    >
      <DialogDescription class="yayaw-sr-only">{{ label("builderDescription") }}</DialogDescription>
      <header class="yayaw-form-builder-bar" data-form-builder-bar>
        <div class="yayaw-form-builder-heading">
          <DialogTitle as="h2" class="yayaw-form-builder-title">{{ label("editForm") }}</DialogTitle>
          <p class="yayaw-form-builder-subtitle" data-form-builder-title>{{ state.title }}</p>
        </div>
        <template v-if="!state.compact">
          <fieldset class="yayaw-form-builder-layout" data-form-builder-layout>
            <legend class="yayaw-form-language-legend">{{ label("layout") }}</legend>
            <span class="yayaw-form-language-options">
              <label
                v-for="layout in LAYOUTS"
                :key="layout"
                class="yayaw-form-language"
                :data-form-builder-layout-option="layout"
              >
                <input
                  class="yayaw-sr-only"
                  type="radio"
                  :name="layoutName"
                  :value="layout"
                  :checked="state.layout === layout"
                  @change="controller.setLayout(layout)"
                />{{ label(layout === "steps" ? "layoutSteps" : "layoutPage") }}
              </label>
            </span>
          </fieldset>
          <FormLanguageSwitch
            :label="label('editingLanguage')"
            :languages="state.languages"
            :value="state.locale"
            :addable="state.addableLocales"
            :add-label="label('addLanguage')"
            can-add
            @change="controller.setLocale($event)"
            @add="controller.addLanguage($event)"
          />
        </template>
        <div class="yayaw-form-builder-bar-end">
          <span v-if="state.dirty" class="yayaw-form-builder-status" data-form-builder-status>
            <span class="yayaw-form-builder-status-dot" aria-hidden="true" />
            <span :class="{ 'yayaw-sr-only': state.compact }">{{ label("unsavedChanges") }}</span>
          </span>
          <button
            v-if="!state.compact"
            type="button"
            class="yayaw-button yayaw-button-ghost yayaw-form-builder-settings"
            @click="controller.select(FORM_BUILDER_FORM)"
          >
            <Settings2 :size="16" aria-hidden="true" />{{ label("settingsTitle") }}
          </button>
          <FormShare
            v-if="share"
            :form-links="share.formLinks"
            :view-id="share.viewId"
            :snapshot="share.snapshot"
            :locale="locale"
            :translate="translate"
            :compact="false"
            :icon-only="state.compact"
            :note="state.dirty ? label('saveToPublish') : undefined"
          />
          <button
            type="button"
            class="yayaw-button yayaw-form-builder-save"
            aria-keyshortcuts="Control+S Meta+S"
            data-form-builder-save
            :disabled="!state.dirty"
            @click="controller.save()"
          >
            {{ label("save") }}
          </button>
          <button
            type="button"
            class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-builder-close"
            :aria-label="label('close')"
            @click="controller.requestClose()"
          >
            <X :size="16" aria-hidden="true" />
          </button>
        </div>
      </header>
      <TabsRoot
        v-if="state.compact"
        class="yayaw-form-builder-tabs"
        :model-value="state.tab"
        @update:model-value="controller.setTab($event as FormBuilderTab)"
      >
        <TabsList class="yayaw-form-builder-tab-list">
          <TabsTrigger
            v-for="tab in TABS"
            :key="tab.value"
            class="yayaw-form-builder-tab"
            :value="tab.value"
            :data-form-builder-tab="tab.value"
          >
            {{ label(tab.key) }}
          </TabsTrigger>
        </TabsList>
        <TabsContent class="yayaw-form-builder-tab-panel" value="outline">
          <FormBuilderOutline :controller="controller" :state="state" :heading-id="`${id}-outline`" :label="label" />
        </TabsContent>
        <TabsContent class="yayaw-form-builder-tab-panel" value="preview">
          <FormBuilderPreview :columns="columns" :state="state" :heading-id="`${id}-preview`" :translate="translate" :label="label">
            <template #language>
              <FormLanguageSwitch
                :label="label('editingLanguage')"
                :languages="state.languages"
                :value="state.locale"
                :addable="state.addableLocales"
                :add-label="label('addLanguage')"
                can-add
                @change="controller.setLocale($event)"
                @add="controller.addLanguage($event)"
              />
            </template>
          </FormBuilderPreview>
        </TabsContent>
        <TabsContent class="yayaw-form-builder-tab-panel" value="properties">
          <FormBuilderProperties
            :controller="controller"
            :state="state"
            :heading-id="`${id}-properties`"
            :locale="locale"
            :translate="translate"
            :label="label"
          >
            <template #language>
              <FormLanguageSwitch
                :label="label('editingLanguage')"
                :languages="state.languages"
                :value="state.locale"
                :addable="state.addableLocales"
                :add-label="label('addLanguage')"
                can-add
                @change="controller.setLocale($event)"
                @add="controller.addLanguage($event)"
              />
            </template>
          </FormBuilderProperties>
        </TabsContent>
      </TabsRoot>
      <div v-else class="yayaw-form-builder-panes">
        <div class="yayaw-form-builder-pane yayaw-form-builder-pane-start">
          <FormBuilderOutline :controller="controller" :state="state" :heading-id="`${id}-outline`" :label="label" />
        </div>
        <FormBuilderPreview :columns="columns" :state="state" :heading-id="`${id}-preview`" :translate="translate" :label="label" />
        <div class="yayaw-form-builder-pane yayaw-form-builder-pane-end">
          <FormBuilderProperties
            :controller="controller"
            :state="state"
            :heading-id="`${id}-properties`"
            :locale="locale"
            :translate="translate"
            :label="label"
          />
        </div>
      </div>
      <output class="yayaw-sr-only" data-form-builder-announcement>{{ state.announcement }}</output>
      <AlertDialogRoot
        :open="state.confirming"
        @update:open="(open: boolean) => { if (!open) controller.keepEditing(); }"
      >
        <AlertDialogPortal>
          <AlertDialogOverlay class="yayaw-form-builder-confirm-backdrop" :style="theme" />
          <AlertDialogContent class="yayaw-form-builder-confirm" :style="theme" data-form-builder-confirm>
            <AlertDialogTitle as="h2" class="yayaw-form-builder-confirm-title">{{ label("discardTitle") }}</AlertDialogTitle>
            <AlertDialogDescription class="yayaw-form-builder-confirm-description">{{ label("discardDescription") }}</AlertDialogDescription>
            <div class="yayaw-form-builder-confirm-actions">
              <button type="button" class="yayaw-button yayaw-button-outline" @click="controller.keepEditing()">
                {{ label("keepEditing") }}
              </button>
              <button type="button" class="yayaw-button yayaw-form-builder-discard" @click="controller.discard()">
                {{ label("discard") }}
              </button>
              <button type="button" class="yayaw-button" @click="controller.saveAndClose()">
                {{ label("saveAndClose") }}
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialogRoot>
    </DialogContent>
  </DialogPortal>
</template>
