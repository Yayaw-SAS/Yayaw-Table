<script setup lang="ts">
import { Eye, RefreshCw, Send, TriangleAlert } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId } from "vue";
import {
  applyConnectorField,
  type ConnectorFlowState,
  connectorConflictRulesView,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorLabels,
  connectorMappingSections,
  connectorRuleHints,
  connectorSchemaBlocker,
  connectorScreenFields,
  connectorSyncBlocker,
  createConnectorFlow,
  type DataDestinationConnector,
  describePendingConflicts,
  describePushDetails,
  describePushResult,
  describeSchemaFixes,
  describeSchemaReport,
  describeSyncPreview,
  describeSyncResult,
  isSyncDirection,
  type PendingConflictResolution,
  type SyncDirection,
} from "../../connector-flow";
import {
  type ConnectorPushContext,
  connectorPushContext,
  type DataDestinationContext,
} from "../../data-destinations";
import TableCheckbox from "../controls/TableCheckbox.vue";
import ColumnMapping from "./ColumnMapping.vue";
import ConnectorAppRules from "./ConnectorAppRules.vue";
import ConnectorConflicts from "./ConnectorConflicts.vue";
import ConnectorCreateTarget from "./ConnectorCreateTarget.vue";
import ConnectorTargetCheck from "./ConnectorTargetCheck.vue";

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
// "Rules set by your app": under the conflict rule in two-way, else under the delete policy.
const rules = computed(() => connectorConflictRulesView(state.value.settings, screen.value));
const rulesAfterConflict = computed(() => Boolean(hints.value.conflictRule));
const conflicts = computed(() =>
  describePendingConflicts(state.value.conflicts, { t, name: props.name, columns: opened.columns, locale: props.locale })
);
const syncing = computed(() => isSyncDirection(state.value.settings?.direction));
const canPreview = computed(() => syncing.value && Boolean(props.connector.preview));
const syncBlocker = computed(() => connectorSyncBlocker(state.value, props.connector));
const schemaBlocked = computed(() => connectorSchemaBlocker(state.value) !== null);
// "Target check": issues, "Prepare …" and "Update mapping"; a blocking issue stops Send and Sync.
const check = computed(() =>
  describeSchemaReport(state.value, { connector: props.connector, name: props.name, t, columns: opened.columns })
);
const fixes = computed(() =>
  describeSchemaFixes(state.value.schemaReport?.fixes ?? [], {
    connector: {},
    name: props.name,
    t,
    schema: state.value.schema,
  })
);
const blocker = computed(() => check.value?.blocked ?? (syncBlocker.value ? t(syncBlocker.value) : null));
const previewView = computed(() =>
  canPreview.value && state.value.preview
    ? describeSyncPreview(state.value.preview, { t, name: props.name, columns: opened.columns, locale: props.locale })
    : null
);
const previewGroups = computed(() => {
  const view = previewView.value;
  if (!view) return [];
  return [
    { id: "conflicts", title: view.conflictsTitle, lines: view.conflicts, more: view.moreConflicts },
    { id: "overridden", title: view.overriddenTitle, lines: view.overridden, more: view.moreOverridden },
  ].filter((group) => group.title !== null);
});
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
const resolveConflicts = (resolutions: PendingConflictResolution[]): void => {
  flow.resolveConflicts(resolutions).catch(() => undefined);
};
const run = (action: () => Promise<void>): void => {
  action().catch(() => undefined);
};
</script>

<template>
  <div class="yayaw-connector-panel" data-connector-panel>
    <p v-if="state.phase === 'loading'" class="yayaw-schedule-loading">
      <span class="yayaw-spinner" aria-hidden="true" />{{ t("loading") }}
    </p>
    <ConnectorConflicts v-else-if="state.conflictsOpen" :view="conflicts" :busy="state.resolvingConflicts"
      :error="state.error" @resolve="resolveConflicts" @back="flow.showConflicts(false)" />
    <div v-else-if="showResult" class="yayaw-connector-result" data-connector-result>
      <output class="yayaw-connector-summary" aria-live="polite">
        <p class="yayaw-connector-counts" data-connector-summary>{{ result.summary }}</p>
        <p v-for="line in result.lines" :key="line" class="yayaw-schedule-muted">{{ line }}</p>
      </output>
      <button v-if="conflicts.entry" type="button" class="yayaw-button yayaw-button-outline yayaw-connector-conflicts-entry"
        data-connector-conflicts-entry @click="flow.showConflicts(true)">
        <TriangleAlert :size="16" aria-hidden="true" />{{ conflicts.entry }}
      </button>
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
      <template #after-target>
        <form v-if="connector.allowTargetInput" class="yayaw-connector-input" data-connector-target-input
          @submit.prevent="resolveInput">
          <label :for="`${id}-input`">{{ connector.allowTargetInput.label }}</label>
          <div class="yayaw-connector-input-row">
            <input :id="`${id}-input`" v-model="input" class="yayaw-input" :placeholder="connector.allowTargetInput.placeholder" />
            <button type="submit" class="yayaw-button yayaw-button-outline" :disabled="state.resolving || !input.trim()"
              :aria-busy="state.resolving">
              <span v-if="state.resolving" class="yayaw-spinner" aria-hidden="true" />{{ t("use") }}
            </button>
          </div>
        </form>
        <div class="yayaw-connector-target-tools" data-connector-target-tools>
          <button type="button" class="yayaw-button yayaw-button-ghost yayaw-connector-refresh" :disabled="state.refreshing"
            :aria-busy="state.refreshing" @click="run(flow.refreshTargets)">
            <RefreshCw :size="14" aria-hidden="true" :class="{ 'yayaw-spin': state.refreshing }" />{{ t("refreshTargets") }}
          </button>
          <p v-if="connector.help?.missingTarget" class="yayaw-connector-hint" data-connector-missing-help>
            {{ connector.help.missingTarget }}
          </p>
        </div>
        <ConnectorCreateTarget v-if="state.createOpen" :parents="state.createParents" :creating="state.creating"
          :name="name" :t="t" @create="(value) => run(() => flow.createTarget(value))"
          @cancel="run(() => flow.showCreate(false))" />
      </template>
      <template #after-mode>
        <p v-if="state.settings" class="yayaw-connector-hint" data-connector-mode-hint>
          {{ t(state.settings.mode === "replace" ? "replaceHint" : "upsertHint") }}
        </p>
      </template>
      <template #after-conflictRule>
        <p v-if="hints.conflictRule" class="yayaw-connector-hint" data-connector-hint="conflictRule">{{ hints.conflictRule }}</p>
        <ConnectorAppRules v-if="rules && rulesAfterConflict" :view="rules" />
      </template>
      <template #after-deletePolicy>
        <p v-if="hints.deletePolicy" class="yayaw-connector-hint" data-connector-hint="deletePolicy">{{ hints.deletePolicy }}</p>
        <label v-if="state.settings?.deletePolicy === 'propagate'" class="yayaw-import-check yayaw-sync-confirm"
          data-connector-delete-confirm>
          <TableCheckbox :model-value="state.confirmDeletes" :label="t('deleteConfirm')" @update:model-value="flow.setConfirmDeletes" />
          <span>{{ t("deleteConfirm") }}</span>
        </label>
        <ConnectorAppRules v-if="rules && !rulesAfterConflict" :view="rules" />
      </template>
      <ConnectorTargetCheck v-if="check" :view="check" :preparing="state.preparing" :prepare-open="state.prepareOpen"
        @prepare="flow.showPrepare(true)" @update-mapping="run(flow.updateMapping)" />
      <section v-if="state.prepareOpen" class="yayaw-connector-prepare" :aria-label="fixes.confirm"
        data-connector-prepare-confirm>
        <p>{{ fixes.intro }}</p>
        <ul>
          <li v-for="line in fixes.lines" :key="line">{{ line }}</li>
        </ul>
        <div class="yayaw-schedule-actions">
          <button type="button" class="yayaw-button" :disabled="state.preparing" :aria-busy="state.preparing"
            @click="run(flow.prepare)">
            <span v-if="state.preparing" class="yayaw-spinner" aria-hidden="true" />{{ state.preparing ? t("preparing") : fixes.confirm }}
          </button>
          <button type="button" class="yayaw-button yayaw-button-outline" :disabled="state.preparing"
            @click="flow.showPrepare(false)">
            {{ fixes.cancel }}
          </button>
        </div>
      </section>
      <p v-if="state.schemaLoading" class="yayaw-schedule-loading">
        <span class="yayaw-spinner" aria-hidden="true" />{{ t("loadingFields") }}
      </p>
      <p v-if="state.phase === 'form' && state.targets.length === 0 && !state.error" class="yayaw-schedule-muted">
        {{ t("noTargets") }}
      </p>
      <button v-if="conflicts.entry" type="button" class="yayaw-button yayaw-button-outline yayaw-connector-conflicts-entry"
        data-connector-conflicts-entry @click="flow.showConflicts(true)">
        <TriangleAlert :size="16" aria-hidden="true" />{{ conflicts.entry }}
      </button>
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
        <div v-for="group in previewGroups" :key="group.id" class="yayaw-sync-conflicts" :data-sync-group="group.id">
          <h3>{{ group.title }}</h3>
          <ul>
            <li v-for="conflict in group.lines" :key="conflict.id" :data-sync-conflict="conflict.id"
              :data-resolution="conflict.resolution">
              <span class="yayaw-sync-conflict-title">{{ conflict.title }}</span>
              <span v-for="side in (['table', 'target'] as const)" :key="side" class="yayaw-sync-value"
                :class="{ 'yayaw-sync-loser': conflict.winner && conflict.winner !== side }"
                :data-winner="conflict.winner === side || undefined">
                <span>{{ conflict[side].label }}</span><span>{{ conflict[side].value }}</span>
              </span>
              <span v-if="conflict.result" class="yayaw-sync-value" data-sync-result>
                <span>{{ conflict.result.label }}</span><span>{{ conflict.result.value }}</span>
              </span>
              <span class="yayaw-schedule-muted" data-sync-outcome>{{ conflict.wins }}</span>
            </li>
          </ul>
          <p v-if="group.more" class="yayaw-sync-note">{{ group.more }}</p>
        </div>
      </output>
      <p v-if="state.error" class="yayaw-connector-error" data-connector-error role="alert">{{ state.error }}</p>
      <p v-if="blocker && !state.error" class="yayaw-connector-hint"
        :class="{ 'yayaw-connector-blocked': schemaBlocked }" data-connector-blocker>{{ blocker }}</p>
      <div class="yayaw-schedule-actions">
        <button v-if="canPreview" type="button" class="yayaw-button yayaw-button-outline"
          :disabled="busy || !state.settings || schemaBlocked" :aria-busy="state.previewing" @click="preview">
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
