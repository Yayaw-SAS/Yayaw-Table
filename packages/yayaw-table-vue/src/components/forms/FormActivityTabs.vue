<script setup lang="ts">
import { History } from "lucide-vue-next";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import type { DetailActivity, DetailField, DetailLabels, DetailRecord, DetailRevertHandler } from "../../record-details";
import RecordActivity from "../details/RecordActivity.vue";
import "../../record-details.css";

/** The edit form's fields and the record's activity, in the record details' tabs; the fields alone when `enabled` is false. */
defineProps<{
  enabled: boolean;
  row?: DetailRecord;
  activity: readonly DetailActivity[];
  fields: readonly DetailField[];
  labels: DetailLabels;
  locale?: string;
  disabled?: boolean;
  onRevertActivity?: DetailRevertHandler;
  canRevert?: (entry: DetailActivity, row: DetailRecord) => boolean;
}>();
const emit = defineEmits<{ reverted: [entry: DetailActivity]; pending: [pending: boolean] }>();
</script>

<template>
  <!-- The fields stay mounted on the activity tab: a draft survives switching tabs. -->
  <TabsRoot v-if="enabled && row" default-value="details" :unmount-on-hide="false" class="yayaw-detail yayaw-detail-tabs yayaw-record-content">
    <TabsList class="yayaw-detail-tablist" :aria-label="labels.record"><TabsTrigger value="details">{{ labels.details }}</TabsTrigger><TabsTrigger value="activity"><History :size="15" aria-hidden="true" />{{ labels.activity }}<span class="yayaw-detail-count">{{ activity.length }}</span></TabsTrigger></TabsList>
    <TabsContent value="details" class="yayaw-record-content"><slot /></TabsContent>
    <TabsContent value="activity" class="yayaw-detail-body yayaw-record-body">
      <RecordActivity :row="row" :activity="activity" :fields="fields" :labels="labels" :locale="locale" :disabled="disabled" :on-revert-activity="onRevertActivity" :can-revert="canRevert" @pending="emit('pending', $event)" @reverted="emit('reverted', $event)" />
    </TabsContent>
  </TabsRoot>
  <slot v-else />
</template>
