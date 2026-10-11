<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from "vue";
import { Clock3, History, Pencil, Trash2 } from "lucide-vue-next";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import { deleteConfirmationMatches, deleteConfirmationValue, detailActivity, detailDate, detailLabels, detailLayout, detailSections, detailTitle, detailValue, type DetailRecord, type RecordDetailsConfig } from "../../record-details";
import type { ColumnDefinition } from "../../types";
import FormDialog from "../forms/FormDialog.vue";
import RecordSurfaceHeader from "../forms/RecordSurfaceHeader.vue";
import DetailValue from "./DetailValue.vue";
import RecordActivity from "./RecordActivity.vue";
import RelatedRecords from "./RelatedRecords.vue";
import TypedConfirmation from "./TypedConfirmation.vue";
import "../../record-details.css";
import type { DetailActivity, DetailRevertHandler } from "../../record-details";

const props = withDefaults(defineProps<{
  editing?: boolean;
  editorBusy?: boolean;
  row: DetailRecord;
  config: RecordDetailsConfig;
  columns?: ColumnDefinition[];
  locale?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onPlanning?: (row: DetailRecord) => void;
  onDelete?: (row: DetailRecord) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onRevertActivity?: DetailRevertHandler;
}>(), { columns: () => [], locale: "en", canEdit: false, canDelete: false });
const emit = defineEmits<{ close: []; edit: [row: DetailRecord]; deleted: [row: DetailRecord]; reverted: [entry: DetailActivity] }>();
const editButton = ref<HTMLButtonElement>();
watch(() => props.editing, async (editing, previous) => { if (previous && !editing) { await nextTick(); editButton.value?.focus(); } });
const labels = computed(() => detailLabels(props.locale, props.config.labels));
const title = computed(() => detailTitle(props.config, props.row, labels.value.record));
const sections = computed(() => detailSections(props.config, props.columns, props.row, labels.value.details));
const layout = computed(() => detailLayout(props.config, props.columns, props.row, labels.value.details));
const slots = useSlots();
// A custom section shows when the host renders it: `#record-section-<id>` or `#record-section`.
// `#detail-field` renders every field without its own `#detail-<id>`; rendering nothing keeps the standard value.
const customSlot = (id: string): `record-section${string}` | undefined => ([`record-section-${id}`, "record-section"] as const).find(name => slots[name]);
const fieldSlot = (id: string): `detail-${string}` => (slots[`detail-${id}`] || !slots["detail-field"] ? `detail-${id}` : "detail-field");
const fields = computed(() => sections.value.flatMap(section => section.fields));
const activity = computed(() => detailActivity(props.config, props.row));
const updated = computed(() => props.config.updatedAt?.(props.row));
const updatedBy = computed(() => props.config.updatedBy?.(props.row));
const confirming = ref(false);
const deleting = ref(false);
const error = ref("");
const undoPending = ref(false);
const cancelButton = ref<HTMLButtonElement>();
const deletionTrigger = ref<HTMLButtonElement>();
const typedField = ref<InstanceType<typeof TypedConfirmation>>();
const typed = ref("");
const expected = computed(() => deleteConfirmationValue(props.config.deleteConfirmation, { row: props.row, title: title.value }, labels.value));
const confirmed = computed(() => deleteConfirmationMatches(expected.value, typed.value, props.config.deleteConfirmation));
const focusConfirmation = (event: Event): void => {
  event.preventDefault();
  if (expected.value === undefined) cancelButton.value?.focus();
  else typedField.value?.focus();
};
const requestDelete = (): void => {
  if (!props.canDelete || !props.onDelete || deleting.value) return;
  error.value = "";
  typed.value = "";
  confirming.value = true;
};
const confirmDelete = async (): Promise<void> => {
  if (!props.canDelete || !props.onDelete || deleting.value || !confirmed.value) return;
  deleting.value = true;
  error.value = "";
  try {
    const result = await props.onDelete(props.row);
    if (!result.success) throw new Error(result.error ?? labels.value.deleteError);
    confirming.value = false;
    // A completed mutation is never retried because a subsequent table refresh fails.
    emit("close");
    emit("deleted", props.row);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : labels.value.deleteError;
  } finally {
    deleting.value = false;
  }
};
</script>

<template>
  <FormDialog :open="true" :title="title" :presentation="config.presentation" :width="config.width" headerless
    :busy="confirming || deleting || undoPending || editorBusy" :close-label="labels.close" @close="emit('close')">
    <slot v-if="editing" name="editor" />
    <article v-else class="yayaw-detail yayaw-record-content" :aria-label="title" :aria-busy="deleting || undoPending">
      <RecordSurfaceHeader :title="title" :description="config.description?.(row)" :close-label="labels.close" :busy="confirming || deleting || undoPending" @close="emit('close')">
        <div class="yayaw-detail-actions">
          <button v-if="canEdit" ref="editButton" type="button" class="yayaw-button yayaw-button-outline" :disabled="confirming || deleting || undoPending" @click="emit('edit', row)"><Pencil :size="15" aria-hidden="true" />{{ labels.edit }}</button>
          <button v-if="onPlanning" type="button" class="yayaw-button" @click="onPlanning(row)">{{ locale?.startsWith('fr') ? 'Planification' : 'Planning' }}</button>
          <button v-if="canDelete && onDelete" ref="deletionTrigger" type="button" class="yayaw-button yayaw-detail-delete" :disabled="confirming || deleting || undoPending" @click="requestDelete"><Trash2 :size="15" aria-hidden="true" />{{ labels.delete }}</button>
        </div>
      </RecordSurfaceHeader>
      <div v-if="updated" class="yayaw-detail-meta"><Clock3 :size="14" aria-hidden="true" /><span>{{ labels.updated }} <time :datetime="updated instanceof Date ? updated.toISOString() : updated">{{ detailDate(updated, locale, true) }}</time><template v-if="updatedBy"> · {{ labels.by }} <strong>{{ updatedBy }}</strong></template></span></div>
      <TabsRoot default-value="details" :unmount-on-hide="false" class="yayaw-detail-tabs yayaw-record-content">
        <TabsList class="yayaw-detail-tablist" :aria-label="labels.record"><TabsTrigger value="details">{{ labels.details }}</TabsTrigger><TabsTrigger value="activity"><History :size="15" aria-hidden="true" />{{ labels.activity }}<span class="yayaw-detail-count">{{ activity.length }}</span></TabsTrigger></TabsList>
        <TabsContent value="details" class="yayaw-detail-body yayaw-record-body">
          <template v-for="item in layout" :key="item.section.id">
            <RelatedRecords v-if="item.kind === 'related'" :section="item.section" :row="row" :labels="labels" :locale="locale" :load-related="config.loadRelated" :on-related-action="config.onRelatedAction" />
            <section v-else-if="item.kind === 'custom' && customSlot(item.section.id)" class="yayaw-detail-section" :data-custom-section="item.section.id">
              <h3>{{ item.section.title }}</h3><p v-if="item.section.description" class="yayaw-detail-description">{{ item.section.description }}</p>
              <slot :name="customSlot(item.section.id) ?? 'record-section'" :row="row" :section="item.section" />
            </section>
            <section v-else-if="item.kind === 'fields'" class="yayaw-detail-section"><h3>{{ item.section.title }}</h3><p v-if="item.section.description" class="yayaw-detail-description">{{ item.section.description }}</p><dl><div v-for="field in item.section.fields" :key="field.id" class="yayaw-detail-field"><dt>{{ field.label }}</dt><dd><slot :name="fieldSlot(field.id)" :row="row" :value="detailValue(row, field)" :field="field"><DetailValue :field="field" :value="detailValue(row, field)" :row="row" :locale="locale" :labels="labels" /></slot></dd></div></dl></section>
          </template>
          <p v-if="!layout.length" class="yayaw-detail-empty">{{ labels.empty }}</p>
        </TabsContent>
        <TabsContent value="activity" class="yayaw-detail-body yayaw-record-body">
          <RecordActivity :row="row" :activity="activity" :fields="fields" :labels="labels" :locale="locale" :disabled="confirming || deleting" :on-revert-activity="onRevertActivity" :can-revert="config.canRevert" @pending="undoPending = $event" @reverted="emit('reverted', $event)" />
        </TabsContent>
      </TabsRoot>
    </article>
    <FormDialog v-if="confirming" :open="true" role="alertdialog" presentation="modal" width="min(460px, 94vw)" :title="labels.confirmDelete" :description="labels.deleteDescription" :busy="deleting" :return-focus="deletionTrigger" :close-label="labels.close" @close="confirming = false" @open-auto-focus="focusConfirmation">
      <div class="yayaw-detail-confirm"><strong>{{ title }}</strong><TypedConfirmation v-if="expected !== undefined" ref="typedField" v-model="typed" :expected="expected" :labels="labels" :confirmation="config.deleteConfirmation" :disabled="deleting" @submit="confirmDelete" /><p v-if="error" class="yayaw-error" role="alert">{{ error }}</p><div><button ref="cancelButton" type="button" class="yayaw-button yayaw-button-outline" :disabled="deleting" @click="confirming = false">{{ labels.cancel }}</button><button type="button" class="yayaw-button yayaw-button-danger" :disabled="deleting || !canDelete || !confirmed" @click="confirmDelete">{{ deleting ? labels.deleting : labels.delete }}</button></div></div>
    </FormDialog>
  </FormDialog>
</template>
