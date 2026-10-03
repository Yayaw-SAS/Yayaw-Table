<script setup lang="ts">
import { toast } from "vue-sonner";
import { ref, watch } from "vue";
import { Undo2 } from "lucide-vue-next";
import { canRevertDetailActivity, detailDate, detailUndoMessage, type DetailActivity, type DetailField, type DetailLabels, type DetailRecord, type DetailRevertHandler } from "../../record-details";
import DetailValue from "./DetailValue.vue";

/** A record's activity timeline and its undo buttons, shared by the record details and the edit form. */
const props = withDefaults(defineProps<{
  row: DetailRecord;
  activity: readonly DetailActivity[];
  fields: readonly DetailField[];
  labels: DetailLabels;
  locale?: string;
  disabled?: boolean;
  onRevertActivity?: DetailRevertHandler;
  canRevert?: (entry: DetailActivity, row: DetailRecord) => boolean;
}>(), { locale: "en" });
const emit = defineEmits<{ reverted: [entry: DetailActivity]; pending: [pending: boolean] }>();
const undoPending = ref<string>();
const undoError = ref<{ id: string; message: string }>();
const completedUndos = ref<string[]>([]);
watch(undoPending, pending => emit("pending", Boolean(pending)));
const fieldFor = (id: string): DetailField | undefined => props.fields.find(field => field.id === id);
const isUndone = (entry: DetailActivity) => completedUndos.value.includes(entry.id) || props.activity.some(item => item.reverts === entry.id);
const canUndo = (entry: DetailActivity) => Boolean(props.onRevertActivity) && !isUndone(entry) && canRevertDetailActivity(entry, props.activity) && props.canRevert?.(entry, props.row) !== false;
const undo = async (entry: DetailActivity): Promise<void> => {
  if (undoPending.value || props.disabled || !canUndo(entry) || !props.onRevertActivity) return;
  undoPending.value = entry.id;
  undoError.value = undefined;
  try {
    const result = await props.onRevertActivity(props.row, entry);
    if (!result.success) throw new Error(result.error ?? props.labels.undoError);
    completedUndos.value.push(entry.id);
    emit("reverted", entry);
    toast.success(detailUndoMessage(entry, props.labels));
  } catch (cause) {
    undoError.value = { id: entry.id, message: cause instanceof Error ? cause.message : props.labels.undoError };
  } finally { undoPending.value = undefined; }
};
</script>

<template>
  <p v-if="!activity.length" class="yayaw-detail-empty">{{ labels.noActivity }}</p>
  <ol v-else class="yayaw-detail-timeline"><li v-for="entry in activity" :key="entry.id"><span class="yayaw-detail-avatar" aria-hidden="true">{{ entry.actor.name.split(' ').map(part => part[0]).slice(0, 2).join('') }}</span><div class="yayaw-detail-event"><p><strong>{{ entry.actor.name }}</strong> {{ entry.action }}</p><time :datetime="entry.at">{{ detailDate(entry.at, locale, true) }}</time><span v-if="isUndone(entry)" class="yayaw-detail-undone">{{ labels.undone }}</span><button v-else-if="onRevertActivity && entry.changes?.length && !entry.reverts && entry.reversible !== false" type="button" class="yayaw-detail-undo" :disabled="!canUndo(entry) || Boolean(undoPending) || disabled" :title="canUndo(entry) ? labels.undo : labels.undoUnavailable" @click="undo(entry)"><Undo2 :size="13" aria-hidden="true" />{{ undoPending === entry.id ? labels.undoing : labels.undo }}</button><p v-if="undoError?.id === entry.id" role="alert" class="yayaw-error">{{ undoError.message }}</p><div v-for="change in entry.changes?.filter(item => fieldFor(item.field))" :key="change.field" class="yayaw-detail-change"><p>{{ fieldFor(change.field)?.label }}</p><div class="yayaw-detail-diff"><div><small>{{ labels.before }}</small><DetailValue :field="fieldFor(change.field)!" :value="change.before" :row="row" :locale="locale" :labels="labels" /></div><span aria-hidden="true">→</span><div><small>{{ labels.after }}</small><DetailValue :field="fieldFor(change.field)!" :value="change.after" :row="row" :locale="locale" :labels="labels" /></div></div></div></div></li></ol>
</template>
