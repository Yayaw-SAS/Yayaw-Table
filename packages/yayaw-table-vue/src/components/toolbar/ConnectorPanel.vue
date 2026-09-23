<script setup lang="ts">
import { Send } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId } from "vue";
import {
  applyConnectorField,
  type ConnectorFlowState,
  type ConnectorTranslate,
  type ConnectorViewColumn,
  connectorLabels,
  connectorMappingSections,
  connectorScreenFields,
  createConnectorFlow,
  type DataDestinationConnector,
  describePushDetails,
  describePushResult,
} from "../../connector-flow";
import {
  type ConnectorPushContext,
  connectorPushContext,
  type DataDestinationContext,
} from "../../data-destinations";
import ColumnMapping from "./ColumnMapping.vue";

/**
 * The connector screen of a Connect destination: target, column mapping,
 * records, then Send and the result. The host only lists targets, describes
 * their fields and pushes; the flow is shared with the React edition.
 */
const props = defineProps<{
  connector: DataDestinationConnector<DataDestinationContext, ConnectorPushContext>;
  context: () => DataDestinationContext;
  columns: ConnectorViewColumn[];
  selectedRows: Record<string, unknown>[];
  locale: string;
  translate: ConnectorTranslate;
}>();
const emit = defineEmits<{ done: [] }>();
const id = useId();
// The view the screen was opened on owns the settings; capture it once.
const opened = {
  context: props.context(),
  columns: props.columns,
  selectedRows: props.selectedRows,
  t: connectorLabels(props.locale, props.translate),
};
const { t } = opened;
const flow = createConnectorFlow({
  connector: props.connector,
  context: opened.context,
  columns: opened.columns,
  selectedCount: opened.selectedRows.length,
  t,
  pushContext: (scope, sent) => connectorPushContext(opened.context, scope, sent, opened.selectedRows),
  onChange: (next) => {
    state.value = next;
  },
});
const state = shallowRef<ConnectorFlowState>(flow.state);
const input = ref("");
onMounted(() => {
  flow.start().catch(() => undefined);
});
onBeforeUnmount(() => flow.dispose());

const sending = computed(() => state.value.phase === "sending");
const showResult = computed(
  () => state.value.phase === "result" || (sending.value && state.value.result !== null)
);
// Target settings, the column mapping, the key field, then mode and records.
const sections = computed(() =>
  connectorMappingSections(
    connectorScreenFields(state.value, {
      connector: props.connector,
      columns: opened.columns,
      selectedCount: opened.selectedRows.length,
      t,
    })
  )
);
const change = (id: string, value: string): void => {
  applyConnectorField(flow, id, value).catch(() => undefined);
};
const summary = computed(() => (state.value.result ? describePushResult(state.value.result, t) : ""));
const details = computed(() =>
  state.value.result ? describePushDetails(state.value.result, t, props.connector.help) : null
);
const send = (): void => {
  flow.send().catch(() => undefined);
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
    <div v-else-if="showResult && state.result" class="yayaw-connector-result" data-connector-result>
      <output class="yayaw-connector-summary" aria-live="polite">
        <p class="yayaw-connector-counts" data-connector-summary>{{ summary }}</p>
        <p v-for="line in details?.failures ?? []" :key="line" class="yayaw-connector-failure">{{ line }}</p>
        <p v-if="details?.warnings" class="yayaw-schedule-muted">{{ details.warnings }}</p>
        <p v-if="details?.truncated" class="yayaw-schedule-muted">{{ details.truncated }}</p>
      </output>
      <p v-if="state.error" class="yayaw-connector-error" role="alert">{{ state.error }}</p>
      <div class="yayaw-schedule-actions">
        <button type="button" class="yayaw-button" @click="emit('done')">{{ t("done") }}</button>
        <button type="button" class="yayaw-button yayaw-button-outline" :disabled="sending" :aria-busy="sending" @click="send">
          <span v-if="sending" class="yayaw-spinner" aria-hidden="true" />{{ t("sendAgain") }}
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
      <p v-if="state.schemaLoading" class="yayaw-schedule-loading">
        <span class="yayaw-spinner" aria-hidden="true" />{{ t("loadingFields") }}
      </p>
      <p v-if="state.phase === 'form' && state.targets.length === 0 && !state.error" class="yayaw-schedule-muted">
        {{ t("noTargets") }}
      </p>
      <p v-if="state.error" class="yayaw-connector-error" data-connector-error role="alert">{{ state.error }}</p>
      <button type="button" class="yayaw-button yayaw-connector-send" :disabled="sending || !state.settings" :aria-busy="sending"
        @click="send">
        <span v-if="sending" class="yayaw-spinner" aria-hidden="true" />
        <Send v-else :size="16" aria-hidden="true" />
        {{ sending ? t("sending") : t("send") }}
      </button>
    </ColumnMapping>
  </div>
</template>
