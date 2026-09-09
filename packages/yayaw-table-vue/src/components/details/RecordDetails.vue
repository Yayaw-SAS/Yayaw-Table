<script setup lang="ts">
import { computed, ref } from "vue";
import { Clock3, History, Pencil, Trash2, Undo2 } from "lucide-vue-next";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import { detailActivity, detailDate, detailLabels, detailSections, detailValue, type DetailField, type DetailRecord, type RecordDetailsConfig } from "../../record-details";
import type { ColumnDefinition } from "../../types";
import FormDialog from "../forms/FormDialog.vue";
import DetailValue from "./DetailValue.vue";
import "../../record-details.css";
import { canRevertDetailActivity, type DetailActivity, type DetailRevertHandler } from "../../record-details";

const props = withDefaults(defineProps<{
  row: DetailRecord;
  config: RecordDetailsConfig;
  columns?: ColumnDefinition[];
  locale?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete?: (row: DetailRecord) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onRevertActivity?: DetailRevertHandler;
}>(), { columns: () => [], locale: "en", canEdit: false, canDelete: false });
const emit = defineEmits<{ close: []; edit: [row: DetailRecord]; deleted: [row: DetailRecord]; reverted: [entry: DetailActivity] }>();
const labels = computed(() => detailLabels(props.locale, props.config.labels));
const title = computed(() => props.config.title?.(props.row) ?? String(props.row.name ?? props.row.title ?? props.row.id ?? labels.value.record));
const sections = computed(() => detailSections(props.config, props.columns, props.row, labels.value.details));
const fields = computed(() => sections.value.flatMap(section => section.fields));
const activity = computed(() => detailActivity(props.config, props.row));
const updated = computed(() => props.config.updatedAt?.(props.row));
const updatedBy = computed(() => props.config.updatedBy?.(props.row));
const confirming = ref(false);
const deleting = ref(false);
const error = ref("");
const undoPending = ref<string>();
const undoError = ref<{ id: string; message: string }>();
const completedUndos = ref<string[]>([]);
const isUndone = (entry: DetailActivity) => completedUndos.value.includes(entry.id) || activity.value.some(item => item.reverts === entry.id);
const canUndo = (entry: DetailActivity) => Boolean(props.onRevertActivity) && !isUndone(entry) && canRevertDetailActivity(entry, activity.value) && props.config.canRevert?.(entry, props.row) !== false;
const undo = async (entry: DetailActivity): Promise<void> => {
  if (undoPending.value || deleting.value || confirming.value || !canUndo(entry) || !props.onRevertActivity) return;
  undoPending.value = entry.id;
  undoError.value = undefined;
  try {
    const result = await props.onRevertActivity(props.row, entry);
    if (!result.success) throw new Error(result.error ?? labels.value.undoError);
    completedUndos.value.push(entry.id);
    emit("reverted", entry);
  } catch (cause) {
    undoError.value = { id: entry.id, message: cause instanceof Error ? cause.message : labels.value.undoError };
  } finally { undoPending.value = undefined; }
};
const cancelButton = ref<HTMLButtonElement>();
const deletionTrigger = ref<HTMLButtonElement>();
const fieldFor = (id: string): DetailField | undefined => fields.value.find(field => field.id === id);
const requestDelete = (): void => {
  if (!props.canDelete || !props.onDelete || deleting.value) return;
  error.value = "";
  confirming.value = true;
};
const confirmDelete = async (): Promise<void> => {
  if (!props.canDelete || !props.onDelete || deleting.value) return;
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
  <component :is="config.presentation === 'inline' ? 'section' : FormDialog"
    :open="true" :title="labels.record" :presentation="config.presentation === 'modal' ? 'modal' : 'drawer'"
    :width="config.width ?? (config.presentation === 'modal' ? 'min(880px, 94vw)' : 'min(720px, 100vw)')"
    :busy="confirming || deleting || Boolean(undoPending)" :close-label="labels.close" @close="emit('close')">
    <article class="yayaw-detail" :aria-label="title" :aria-busy="deleting || Boolean(undoPending)">
      <header class="yayaw-detail-header">
        <div class="yayaw-detail-heading"><p class="yayaw-detail-eyebrow">{{ labels.record }} <span v-if="row.id">/ {{ row.id }}</span></p><h2>{{ title }}</h2><p v-if="config.description" class="yayaw-detail-description">{{ config.description(row) }}</p></div>
        <div class="yayaw-detail-actions">
          <button v-if="canEdit" type="button" class="yayaw-button yayaw-button-outline" :disabled="confirming || deleting || Boolean(undoPending)" @click="emit('edit', row)"><Pencil :size="15" aria-hidden="true" />{{ labels.edit }}</button>
          <button v-if="canDelete && onDelete" ref="deletionTrigger" type="button" class="yayaw-button yayaw-detail-delete" :disabled="confirming || deleting || Boolean(undoPending)" @click="requestDelete"><Trash2 :size="15" aria-hidden="true" />{{ labels.delete }}</button>
          <button v-if="config.presentation === 'inline'" type="button" class="yayaw-icon-button" :aria-label="labels.close" :disabled="confirming || deleting || Boolean(undoPending)" @click="emit('close')">×</button>
        </div>
      </header>
      <div v-if="updated" class="yayaw-detail-meta"><Clock3 :size="14" aria-hidden="true" /><span>{{ labels.updated }} <time :datetime="updated instanceof Date ? updated.toISOString() : updated">{{ detailDate(updated, locale, true) }}</time><template v-if="updatedBy"> · {{ labels.by }} <strong>{{ updatedBy }}</strong></template></span></div>
      <TabsRoot default-value="details" class="yayaw-detail-tabs">
        <TabsList class="yayaw-detail-tablist" :aria-label="labels.record"><TabsTrigger value="details">{{ labels.details }}</TabsTrigger><TabsTrigger value="activity"><History :size="15" aria-hidden="true" />{{ labels.activity }}<span class="yayaw-detail-count">{{ activity.length }}</span></TabsTrigger></TabsList>
        <TabsContent value="details" class="yayaw-detail-body">
          <section v-for="section in sections" :key="section.id" class="yayaw-detail-section"><h3>{{ section.title }}</h3><p v-if="section.description" class="yayaw-detail-description">{{ section.description }}</p><dl><div v-for="field in section.fields" :key="field.id" class="yayaw-detail-field"><dt>{{ field.label }}</dt><dd><slot :name="`detail-${field.id}`" :row="row" :value="detailValue(row, field)" :field="field"><DetailValue :field="field" :value="detailValue(row, field)" :row="row" :locale="locale" :labels="labels" /></slot></dd></div></dl></section>
          <p v-if="!sections.length" class="yayaw-detail-empty">{{ labels.empty }}</p>
        </TabsContent>
        <TabsContent value="activity" class="yayaw-detail-body">
          <p v-if="!activity.length" class="yayaw-detail-empty">{{ labels.noActivity }}</p>
          <ol v-else class="yayaw-detail-timeline"><li v-for="entry in activity" :key="entry.id"><span class="yayaw-detail-avatar" aria-hidden="true">{{ entry.actor.name.split(' ').map(part => part[0]).slice(0, 2).join('') }}</span><div class="yayaw-detail-event"><p><strong>{{ entry.actor.name }}</strong> {{ entry.action }}</p><time :datetime="entry.at">{{ detailDate(entry.at, locale, true) }}</time><span v-if="isUndone(entry)" class="yayaw-detail-undone">{{ labels.undone }}</span><button v-else-if="onRevertActivity && entry.changes?.length && !entry.reverts && entry.reversible !== false" type="button" class="yayaw-detail-undo" :disabled="!canUndo(entry) || Boolean(undoPending) || confirming || deleting" :title="canUndo(entry) ? labels.undo : labels.undoUnavailable" @click="undo(entry)"><Undo2 :size="13" aria-hidden="true" />{{ undoPending === entry.id ? labels.undoing : labels.undo }}</button><p v-if="undoError?.id === entry.id" role="alert" class="yayaw-error">{{ undoError.message }}</p><div v-for="change in entry.changes?.filter(item => fieldFor(item.field))" :key="change.field" class="yayaw-detail-change"><p>{{ fieldFor(change.field)?.label }}</p><div class="yayaw-detail-diff"><div><small>{{ labels.before }}</small><DetailValue :field="fieldFor(change.field)!" :value="change.before" :row="row" :locale="locale" :labels="labels" /></div><span aria-hidden="true">→</span><div><small>{{ labels.after }}</small><DetailValue :field="fieldFor(change.field)!" :value="change.after" :row="row" :locale="locale" :labels="labels" /></div></div></div></div></li></ol>
        </TabsContent>
      </TabsRoot>
    </article>
    <FormDialog v-if="confirming" :open="true" role="alertdialog" presentation="modal" width="min(460px, 94vw)" :title="labels.confirmDelete" :description="labels.deleteDescription" :busy="deleting" :return-focus="deletionTrigger" :close-label="labels.close" @close="confirming = false" @open-auto-focus="event => { event.preventDefault(); cancelButton?.focus(); }">
      <div class="yayaw-detail-confirm"><strong>{{ title }}</strong><p v-if="error" class="yayaw-error" role="alert">{{ error }}</p><div><button ref="cancelButton" type="button" class="yayaw-button yayaw-button-outline" :disabled="deleting" @click="confirming = false">{{ labels.cancel }}</button><button type="button" class="yayaw-button yayaw-button-danger" :disabled="deleting || !canDelete" @click="confirmDelete">{{ deleting ? labels.deleting : labels.delete }}</button></div></div>
    </FormDialog>
  </component>
</template>
