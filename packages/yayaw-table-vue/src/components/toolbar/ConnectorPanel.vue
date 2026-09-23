<script setup lang="ts">
import { Eye, RefreshCw, Send } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId } from "vue";
import {
  applyConnectorField,
  type ConnectorFlowState,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorLabels,
  connectorMappingSections,
  connectorRuleHints,
  connectorScreenFields,
  connectorSyncBlocker,
  createConnectorFlow,
  type DataDestinationConnector,
  describePushDetails,
  describePushResult,
  describeSyncPreview,
  describeSyncResult,
  isSyncDirection,
  type SyncDirection,
} from "../../connector-flow";
import {
  type ConnectorPushContext,
  connectorPushContext,
  type DataDestinationContext,
} from "../../data-destinations";
import TableCheckbox from "../controls/TableCheckbox.vue";
import ColumnMapping from "./ColumnMapping.vue";

/**
 * The connector screen of a Connect destination: target, direction, column
 * mapping, records or sync rules, then Send (or Preview and Sync now) and the
 * result. The host only lists targets, describes their fields, pushes,
 * previews and syncs; the flow is shared with the React edition.
 */
const props = defineProps<{
  connector: DataDestinationConnector<DataDestinationContext, ConnectorPushContext>;
  context: () => DataDestinationContext;
  columns: ConnectorViewColumn[];
  selectedRows: Record<string, unknown>[];
  locale: string;
  translate: ConnectorTranslate;
  /** The destination's name, e.g. "Spreadsheet". */
  name: string;
  /** `table.sync` (default true). */
  syncEnabled?: boolean;
  /** Direction to open with, e.g. "pull" from Data › Import. */
  direction?: SyncDirection;
}>();
const emit = defineEmits<{ done: []; synced: [] }>();
const id = useId();
// The view the screen was opened on owns the settings; capture it once.
const opened = {
  context: props.context(),
  columns: props.columns,
  selectedRows: props.selectedRows,
  syncEnabled: props.syncEnabled !== false,
  t: connectorLabels(props.locale, props.translate),
};
const { t } = opened;
const flow = createConnectorFlow({
  connector: props.connector,
  context: opened.context,
  columns: opened.columns,
  selectedCount: opened.selectedRows.length,
  t,
  syncEnabled: opened.syncEnabled,
  direction: props.direction,
  pushContext: (scope, sent) => connectorPushContext(opened.context, scope, sent, opened.selectedRows),
  onChange: (next) => {
    state.value = next;
  },
  onSynced: () => emit("synced"),
});
const state = shallowRef<ConnectorFlowState>(flow.state);
const input = ref("");
onMounted(() => {
  flow.start().catch(() => undefined);
});
onBeforeUnmount(() => flow.dispose());

const sending = computed(() => state.value.phase === "sending");
const busy = computed(() => sending.value || state.value.previewing);
const showResult = computed(
  () =>
    state.value.phase === "result" ||
    (sending.value && (state.value.result !== null || state.value.syncResult !== null))
);
const screen = computed(() => ({
  connector: props.connector,
  columns: opened.columns,
  selectedCount: opened.selectedRows.length,
  t,
  name: props.name,
  locale: props.locale,
  syncEnabled: opened.syncEnabled,
}));
// Target settings, the column mapping, the key field, then mode, records and the sync rules.
const sections = computed(() => connectorMappingSections(connectorScreenFields(state.value, screen.value)));
const hints = computed(() => connectorRuleHints(state.value.settings, screen.value));
const syncing = computed(() => isSyncDirection(state.value.settings?.direction));
const canPreview = computed(() => syncing.value && Boolean(props.connector.preview));
const blocker = computed(() => connectorSyncBlocker(state.value, props.connector));
const previewView = computed(() =>
  canPreview.value && state.value.preview
    ? describeSyncPreview(state.value.preview, { t, name: props.name, columns: opened.columns })
    : null
);
const sendLabel = computed(() => {
  if (!syncing.value) return sending.value ? t("sending") : t("send");
  if (sending.value) return t("syncing");
  return state.value.settings?.direction === "pull" ? t("importNow") : t("syncNow");
});
const change = (fieldId: string, value: string): void => {
  applyConnectorField(flow, fieldId, value).catch(() => undefined);
};
const result = computed(() => {
  const { syncResult, result: pushed } = state.value;
  if (syncResult) return describeSyncResult(syncResult, { t, name: props.name, help: props.connector.help });
  if (!pushed) return { summary: "", lines: [] as string[] };
  const details = describePushDetails(pushed, t, props.connector.help);
  return {
    summary: describePushResult(pushed, t),
    lines: [...details.failures, ...(details.warnings ? [details.warnings] : []), ...(details.truncated ? [details.truncated] : [])],
  };
});
const againLabel = computed(() => {
  if (!state.value.syncResult) return t("sendAgain");
  return props.connector.preview ? t("previewAgain") : t("syncNow");
});
const send = (): void => {
  flow.send().catch(() => undefined);
};
const preview = (): void => {
  flow.preview().catch(() => undefined);
};
const again = (): void => {
  if (!state.value.syncResult) {
    send();
    return;
  }
  flow.edit();
  if (props.connector.preview) preview();
};
const resolveInput = (): void => {
  flow.resolveInput(input.value).catch(() => undefined);
};
</script>

<template>
  <div class="yayaw-connector-panel" data-connector-panel>
    <p v-if="state.phase === 'loading'" class="yayaw-schedule-loading">
      <span class="yayaw-spinner" aria-hidden="true" />{{ t("loading") }}
    </p>
    <div v-else-if="showResult" class="yayaw-connector-result" data-connector-result>
      <output class="yayaw-connector-summary" aria-live="polite">
        <p class="yayaw-connector-counts" data-connector-summary>{{ result.summary }}</p>
        <p v-for="line in result.lines" :key="line" class="yayaw-schedule-muted">{{ line }}</p>
      </output>
      <p v-if="state.error" class="yayaw-connector-error" role="alert">{{ state.error }}</p>
      <div class="yayaw-schedule-actions">
        <button type="button" class="yayaw-button" @click="emit('done')">{{ t("done") }}</button>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" :aria-busy="busy" @click="again">
          <span v-if="busy" class="yayaw-spinner" aria-hidden="true" />{{ againLabel }}
        </button>
      </div>
    </div>
    <ColumnMapping v-else :before="sections.before" :rows="sections.rows" :key-field="sections.keyField"
      :after="sections.after" @change="change">
      <template v-if="connector.allowTargetInput" #after-target>
        <form class="yayaw-connector-input" data-connector-target-input @submit.prevent="resolveInput">
          <label :for="`${id}-input`">{{ connector.allowTargetInput.label }}</label>
          <div class="yayaw-connector-input-row">
            <input :id="`${id}-input`" v-model="input" class="yayaw-input" :placeholder="connector.allowTargetInput.placeholder" />
            <button type="submit" class="yayaw-button yayaw-button-outline" :disabled="state.resolving || !input.trim()"
              :aria-busy="state.resolving">
              <span v-if="state.resolving" class="yayaw-spinner" aria-hidden="true" />{{ t("use") }}
            </button>
          </div>
        </form>
      </template>
      <template #after-mode>
        <p v-if="state.settings" class="yayaw-connector-hint" data-connector-mode-hint>
          {{ t(state.settings.mode === "replace" ? "replaceHint" : "upsertHint") }}
        </p>
      </template>
      <template #after-conflictRule>
        <p v-if="hints.conflictRule" class="yayaw-connector-hint" data-connector-hint="conflictRule">{{ hints.conflictRule }}</p>
      </template>
      <template #after-deletePolicy>
        <p v-if="hints.deletePolicy" class="yayaw-connector-hint" data-connector-hint="deletePolicy">{{ hints.deletePolicy }}</p>
        <label v-if="state.settings?.deletePolicy === 'propagate'" class="yayaw-import-check yayaw-sync-confirm"
          data-connector-delete-confirm>
          <TableCheckbox :model-value="state.confirmDeletes" :label="t('deleteConfirm')" @update:model-value="flow.setConfirmDeletes" />
          <span>{{ t("deleteConfirm") }}</span>
        </label>
      </template>
      <p v-if="state.schemaLoading" class="yayaw-schedule-loading">
        <span class="yayaw-spinner" aria-hidden="true" />{{ t("loadingFields") }}
      </p>
      <p v-if="state.phase === 'form' && state.targets.length === 0 && !state.error" class="yayaw-schedule-muted">
        {{ t("noTargets") }}
      </p>
      <output v-if="previewView" class="yayaw-sync-preview" aria-live="polite" data-sync-preview>
        <div class="yayaw-sync-sides">
          <div v-for="side in previewView.sides" :key="side.side" class="yayaw-sync-side" :data-sync-side="side.side">
            <h3>{{ side.title }}</h3>
            <dl>
              <div v-for="count in side.counts" :key="count.key">
                <dt>{{ count.label }}</dt>
                <dd :class="{ 'yayaw-sync-zero': count.count === 0 }" :data-sync-count="`${side.side}-${count.key}`">{{ count.count }}</dd>
              </div>
            </dl>
          </div>
        </div>
        <p v-for="note in previewView.notes" :key="note" class="yayaw-sync-note" data-sync-note>{{ note }}</p>
        <p v-if="previewView.duplicates" class="yayaw-sync-warning" data-sync-duplicates>{{ previewView.duplicates }}</p>
        <div v-if="previewView.conflictsTitle" class="yayaw-sync-conflicts" data-sync-conflicts>
          <h3>{{ previewView.conflictsTitle }}</h3>
          <ul>
            <li v-for="conflict in previewView.conflicts" :key="conflict.id" :data-sync-conflict="conflict.id">
              <span class="yayaw-sync-conflict-title">{{ conflict.title }}</span>
              <span v-for="side in (['table', 'target'] as const)" :key="side" class="yayaw-sync-value"
                :class="{ 'yayaw-sync-loser': conflict.resolution !== side }" :data-winner="conflict.resolution === side || undefined">
                <span>{{ conflict[side].label }}</span><span>{{ conflict[side].value }}</span>
              </span>
              <span class="yayaw-schedule-muted">{{ conflict.wins }}</span>
            </li>
          </ul>
          <p v-if="previewView.moreConflicts" class="yayaw-sync-note">{{ previewView.moreConflicts }}</p>
        </div>
      </output>
      <p v-if="state.error" class="yayaw-connector-error" data-connector-error role="alert">{{ state.error }}</p>
      <p v-if="blocker && !state.error" class="yayaw-connector-hint" data-connector-blocker>{{ t(blocker) }}</p>
      <div class="yayaw-schedule-actions">
        <button v-if="canPreview" type="button" class="yayaw-button yayaw-button-outline"
          :disabled="busy || !state.settings" :aria-busy="state.previewing" @click="preview">
          <span v-if="state.previewing" class="yayaw-spinner" aria-hidden="true" />
          <Eye v-else :size="16" aria-hidden="true" />
          {{ state.previewing ? t("previewing") : t("previewChanges") }}
        </button>
        <button type="button" class="yayaw-button yayaw-connector-send" :disabled="busy || !state.settings || Boolean(blocker)"
          :aria-busy="sending" @click="send">
          <span v-if="sending" class="yayaw-spinner" aria-hidden="true" />
          <RefreshCw v-else-if="syncing" :size="16" aria-hidden="true" />
          <Send v-else :size="16" aria-hidden="true" />
          {{ sendLabel }}
        </button>
      </div>
    </ColumnMapping>
  </div>
</template>
