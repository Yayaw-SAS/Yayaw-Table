<script setup lang="ts">
/**
 * The widget dialog, adding or editing a widget in three steps: what (a
 * number, a view, a table page, a note or one of the host's blocks, as the
 * section takes them), its source (the host's catalogue, searchable; sources
 * this user cannot use are listed, disabled, with the reason) and its
 * settings (a saved, default or custom view edited in the view editor; the
 * number's value, period and trend; a block's settings or props as JSON,
 * checked before they apply).
 */
import { ChevronLeft, Pencil, X } from "lucide-vue-next";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import { canonicalViewConfig } from "../view-config";
import DashboardBlockProps from "./DashboardBlockProps.vue";
import DashboardKpiFields from "./DashboardKpiFields.vue";
import DashboardSourcePicker from "./DashboardSourcePicker.vue";
import DashboardViewEditor from "./DashboardViewEditor.vue";
import { tableInfo } from "./dashboard-composables";
import {
  type DashboardBlockPropsDraft,
  type DashboardWidgetChoice,
  type DashboardWidgetDialogTarget,
  dashboardBlockPropsText,
  dashboardKindReadsSource,
  dashboardViewEditStart,
  dashboardWidgetChoices,
  parseDashboardBlockProps,
} from "./dashboard-editor-model";
import {
  type DashboardOverflow,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidgetDraft,
  dashboardUnavailableText,
  dashboardWidgetDraft,
  dashboardWidgetFromDraft,
  emptyWidgetDraft,
  loadDashboardViews,
} from "./dashboard-model";
import {
  checkDashboardBlockProps,
  type DashboardWidget,
} from "./dashboard-schema";
import type { DashboardSourceLoader } from "./dashboard-sources";
import type {
  DashboardBlockRegistry,
  DashboardLabel,
  DashboardTableSource,
} from "./dashboard-types";

const props = defineProps<{
  target: DashboardWidgetDialogTarget;
  loader: DashboardSourceLoader<DashboardTableSource>;
  blocks?: DashboardBlockRegistry;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  /** For the view editor's table. */
  renderers?: DisplayModeRenderers;
  getRowId?: (row: TableRecord) => string;
  tableTranslations?: DataTableTranslations;
}>();
const emit = defineEmits<{
  close: [];
  /** The widget the dialog describes (without its id), and its source's saved views. */
  submit: [widget: Omit<DashboardWidget, "id">, views: readonly DashboardView[] | undefined];
}>();

type Step = "what" | "source" | "settings";
const STEP_LABELS = { what: "stepWhat", source: "stepSource", settings: "stepSettings" } as const;
/** Value of "Start from" for a custom view (never a saved view's id). */
const CUSTOM_VIEW = "__custom_view__";

const target = props.target;
const editing = target.mode === "edit";
// Replaced on every change (never mutated): shallow, like the JSON it holds.
const draft = shallowRef<DashboardWidgetDraft>(
  target.mode === "edit" ? dashboardWidgetDraft(target.widget, props.locale) : emptyWidgetDraft()
);
const step = ref<Step>(editing ? "settings" : "what");
const picking = ref<string>();
const pickError = ref<string>();
const propsText = ref(dashboardBlockPropsText(draft.value.props));
const propsCheck = shallowRef<DashboardBlockPropsDraft>();
const viewEditing = ref(false);
const prefix = `dashboard-widget-${useId()}`;

// Sources change state as they load: follow them.
const version = ref(0);
const unsubscribe = props.loader.subscribe(() => {
  version.value += 1;
});
let unmounted = false;
onBeforeUnmount(() => {
  unmounted = true;
  unsubscribe();
});

const reads = computed(() => dashboardKindReadsSource(draft.value.type));
const source = computed(() => {
  version.value;
  const state = draft.value.tableId ? props.loader.state(draft.value.tableId) : undefined;
  return state?.status === "ready" ? state.source : undefined;
});
const info = computed(() => (source.value ? tableInfo(draft.value.tableId, source.value) : undefined));
const sourceName = computed(() => info.value?.name ?? draft.value.tableId);
// An edited widget's source loads once, like on the screen.
watch(
  () => [reads.value, draft.value.tableId] as const,
  ([sourced, tableId]) => {
    if (sourced && tableId) props.loader.load(tableId).catch(() => undefined);
  },
  { immediate: true }
);
/** The saved views of the source picked (static ones, then `views.list`). */
const views = shallowRef<DashboardView[]>();
watch(
  () => [source.value, draft.value.tableId] as const,
  ([picked, tableId], _previous, onCleanup) => {
    views.value = undefined;
    if (!(picked && tableId)) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    loadDashboardViews(picked, tableId)
      .catch(() => loadDashboardViews({ views: picked.views }, tableId))
      .then((loaded) => {
        if (!cancelled) views.value = loaded;
      })
      .catch(() => undefined);
  },
  { immediate: true }
);
const knownView = computed(() => views.value?.some((view) => view.id === draft.value.viewId) ?? false);

const steps = computed<Step[]>(() => {
  const all: Step[] = reads.value ? ["what", "source", "settings"] : ["what", "settings"];
  return editing ? all.filter((item) => item !== "what") : all;
});
const index = computed(() => steps.value.indexOf(step.value));
const choices = computed(() =>
  dashboardWidgetChoices({
    section: target.mode === "add" ? target.sectionType : undefined,
    blocks: props.blocks,
    locale: props.locale,
    translate: props.translate,
  })
);
const groups = computed(() => [...new Set(choices.value.map((choice) => choice.group))]);
const inGroup = (group: string) => choices.value.filter((choice) => choice.group === group);
const choiceKey = (choice: DashboardWidgetChoice) => choice.block ?? choice.kind;

const chooseKind = (choice: DashboardWidgetChoice): void => {
  const block =
    choice.block && props.blocks && Object.hasOwn(props.blocks, choice.block)
      ? props.blocks[choice.block]
      : undefined;
  const blockProps = { ...block?.defaultProps };
  draft.value = {
    ...emptyWidgetDraft(),
    type: choice.kind,
    ...(choice.block ? { block: choice.block, props: blockProps } : {}),
  };
  propsText.value = dashboardBlockPropsText(blockProps);
  propsCheck.value = undefined;
  step.value = dashboardKindReadsSource(choice.kind) ? "source" : "settings";
};
const pickSource = (id: string): void => {
  picking.value = id;
  pickError.value = undefined;
  props.loader
    .load(id)
    .then((loaded) => {
      if (unmounted) return;
      picking.value = undefined;
      if (loaded.status !== "ready") {
        pickError.value =
          loaded.status === "unavailable"
            ? dashboardUnavailableText(loaded.reason, loaded.message, props.locale, props.translate)
            : props.label("widgetError", { error: loaded.status === "error" ? loaded.message : "" });
        return;
      }
      if (draft.value.tableId !== id) {
        const { view: _view, ...rest } = draft.value;
        draft.value = {
          ...rest,
          tableId: id,
          viewId: "",
          metricColumn: "",
          dateColumn: "",
          compare: false,
          sparkline: false,
        };
      }
      step.value = "settings";
    })
    .catch(() => {
      picking.value = undefined;
    });
};
const chooseView = (value: string): void => {
  const { view: _view, ...rest } = draft.value;
  if (value !== CUSTOM_VIEW) {
    draft.value = { ...rest, viewId: value };
    return;
  }
  // A custom view starts from the view chosen so far.
  const saved = views.value?.find((view) => view.id === draft.value.viewId);
  draft.value = { ...rest, viewId: "", view: saved ? canonicalViewConfig(saved.config) : {} };
};
const setDraft = (patch: Partial<DashboardWidgetDraft>): void => {
  draft.value = { ...draft.value, ...patch };
};
const setText = (text: string): void => {
  propsText.value = text;
  propsCheck.value = undefined;
};
const back = (): void => {
  step.value = steps.value[index.value - 1] ?? step.value;
};
const ready = computed(() => (reads.value ? Boolean(draft.value.tableId) : true));
const submit = (): void => {
  // Enter in the catalogue's search picks a source; only settings submit.
  if (step.value !== "settings") return;
  let next = draft.value;
  const key = next.block;
  if (next.type === "block" && key) {
    const hasSettings = Boolean(props.blocks && Object.hasOwn(props.blocks, key) && props.blocks[key]?.settings);
    const checked: DashboardBlockPropsDraft = hasSettings
      ? { json: true, ...checkDashboardBlockProps(key, next.props ?? {}, { blocks: props.blocks }) }
      : parseDashboardBlockProps(propsText.value, key, { blocks: props.blocks });
    propsCheck.value = checked;
    if (!(checked.ok && checked.props)) return;
    next = { ...next, props: checked.props };
  }
  emit(
    "submit",
    dashboardWidgetFromDraft(next, target.mode === "edit" ? { widget: target.widget, locale: props.locale } : undefined),
    views.value
  );
  emit("close");
};
const viewStart = computed(() => dashboardViewEditStart({ view: draft.value.view ?? {} }));
</script>

<template>
  <DialogRoot :open="true" @update:open="(open: boolean) => { if (!open) emit('close'); }">
    <DialogPortal>
      <DialogOverlay class="yayaw-dashboard-dialog-backdrop" />
      <DialogContent
        class="yayaw-dashboard-dialog yayaw-dashboard-dialog-wide"
        data-dashboard-dialog="widget"
        :data-widget-step="step"
      >
        <div class="yayaw-dashboard-dialog-heading">
          <DialogTitle as="h2">{{ props.label(editing ? "editWidgetTitle" : "addWidgetTitle") }}</DialogTitle>
          <DialogDescription class="yayaw-dashboard-muted" data-widget-step-label="">
            {{ props.label("stepOf", { step: index + 1, count: steps.length }) }} · {{ props.label(STEP_LABELS[step]) }}
          </DialogDescription>
        </div>
        <DialogClose class="yayaw-dashboard-icon-button yayaw-dashboard-dialog-close" :aria-label="props.label('close')">
          <X :size="16" aria-hidden="true" />
        </DialogClose>
        <form class="yayaw-dashboard-form" @submit.prevent="submit">
          <fieldset v-if="step === 'what'" class="yayaw-dashboard-kinds" data-widget-kinds="">
            <legend>{{ props.label("chooseKind") }}</legend>
            <div v-for="group in groups" :key="group || '-'" class="yayaw-dashboard-kind-group">
              <p v-if="group" class="yayaw-dashboard-kind-heading" data-kind-group="">{{ group }}</p>
              <ul class="yayaw-dashboard-kind-list">
                <li v-for="choice in inGroup(group)" :key="choiceKey(choice)">
                  <button
                    type="button"
                    class="yayaw-dashboard-kind"
                    :aria-label="choice.label"
                    :aria-describedby="choice.description ? `${prefix}-${choiceKey(choice)}` : undefined"
                    :data-widget-kind="choice.kind"
                    :data-widget-block="choice.block"
                    @click="chooseKind(choice)"
                  >
                    <span class="yayaw-dashboard-kind-label">{{ choice.label }}</span>
                    <span v-if="choice.description" :id="`${prefix}-${choiceKey(choice)}`" class="yayaw-dashboard-kind-hint">{{ choice.description }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </fieldset>
          <div v-else-if="step === 'source'" class="yayaw-dashboard-form">
            <DashboardSourcePicker
              :loader="props.loader"
              :label="props.label"
              :locale="props.locale"
              :translate="props.translate"
              :value="draft.tableId"
              :picking="picking"
              @pick="pickSource"
            />
            <p v-if="pickError" class="yayaw-dashboard-props-error" role="alert">{{ pickError }}</p>
          </div>
          <template v-else>
            <p v-if="reads" class="yayaw-dashboard-muted yayaw-dashboard-source-line" data-widget-source="">
              {{ props.label("stepSource") }}: <span>{{ sourceName }}</span>
            </p>
            <template v-if="reads">
              <div class="yayaw-dashboard-field">
                <label :for="`${prefix}-view`">{{ props.label("startFrom") }}</label>
                <select
                  :id="`${prefix}-view`"
                  class="yayaw-select"
                  :value="draft.view ? CUSTOM_VIEW : draft.viewId"
                  @change="chooseView(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">{{ props.label("defaultView") }}</option>
                  <optgroup v-if="views?.length" :label="props.label('savedViews')">
                    <option v-for="view in views" :key="view.id" :value="view.id">{{ view.name }}</option>
                  </optgroup>
                  <option v-if="draft.viewId && !knownView" :value="draft.viewId">{{ draft.viewId }}</option>
                  <option :value="CUSTOM_VIEW">{{ props.label("customView") }}</option>
                </select>
              </div>
              <div v-if="draft.view" class="yayaw-dashboard-custom-view" data-custom-view="">
                <p>{{ props.label("customViewHint") }}</p>
                <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!source" @click="viewEditing = true">
                  <Pencil :size="16" aria-hidden="true" />{{ props.label("editView") }}
                </button>
              </div>
            </template>
            <div v-if="draft.type === 'view'" class="yayaw-dashboard-field">
              <label :for="`${prefix}-overflow`">{{ props.label("overflow") }}</label>
              <select
                :id="`${prefix}-overflow`"
                class="yayaw-select"
                :value="draft.overflow"
                @change="setDraft({ overflow: ($event.target as HTMLSelectElement).value as DashboardOverflow })"
              >
                <option value="fit">{{ props.label("overflowFit") }}</option>
                <option value="scroll">{{ props.label("overflowScroll") }}</option>
              </select>
            </div>
            <DashboardKpiFields
              v-if="draft.type === 'kpi' && info"
              :draft="draft"
              :columns="info.columns"
              :prefix="prefix"
              :label="props.label"
              :locale="props.locale"
              :translate="props.translate"
              @update:draft="(next) => (draft = next)"
            />
            <div class="yayaw-dashboard-field">
              <label :for="`${prefix}-title`">{{ props.label("widgetTitle") }}</label>
              <input
                :id="`${prefix}-title`"
                class="yayaw-input"
                maxlength="120"
                :value="draft.title"
                @input="setDraft({ title: ($event.target as HTMLInputElement).value })"
              >
            </div>
            <div v-if="draft.type === 'note'" class="yayaw-dashboard-field">
              <label :for="`${prefix}-text`">{{ props.label("noteText") }}</label>
              <textarea
                :id="`${prefix}-text`"
                class="yayaw-textarea"
                rows="5"
                maxlength="20000"
                :value="draft.text"
                @input="setDraft({ text: ($event.target as HTMLTextAreaElement).value })"
              />
            </div>
            <DashboardBlockProps
              v-if="draft.type === 'block'"
              :blocks="props.blocks"
              :draft="draft"
              :text="propsText"
              :check="propsCheck"
              :id="`${prefix}-props`"
              :label="props.label"
              :locale="props.locale"
              :widget-id="target.mode === 'edit' ? target.widget.id : ''"
              @update:draft="(next) => (draft = next)"
              @update:text="setText"
            />
          </template>
          <footer class="yayaw-dashboard-dialog-footer">
            <button v-if="index > 0" type="button" class="yayaw-button yayaw-button-ghost yayaw-dashboard-back" @click="back">
              <ChevronLeft :size="16" aria-hidden="true" />{{ props.label("back") }}
            </button>
            <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('close')">{{ props.label("cancel") }}</button>
            <button v-if="step === 'settings'" type="submit" class="yayaw-button" :disabled="!ready">
              {{ props.label(editing ? "apply" : "add") }}
            </button>
          </footer>
        </form>
        <DashboardViewEditor
          v-if="viewEditing && source"
          :source="source"
          :source-id="draft.tableId"
          :start="viewStart"
          :subtitle="sourceName"
          :label="props.label"
          :locale="props.locale"
          :renderers="props.renderers"
          :get-row-id="props.getRowId"
          :translations="props.tableTranslations"
          @apply="(view) => setDraft({ viewId: '', view })"
          @close="viewEditing = false"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
