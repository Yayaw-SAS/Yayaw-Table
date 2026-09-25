<script setup lang="ts">
import { computed, toRaw } from "vue";
import type { DashboardBlockPropsDraft } from "./dashboard-editor-model";
import type { DashboardWidgetDraft } from "./dashboard-model";
import type { DashboardJsonObject } from "./dashboard-schema";
import type { DashboardBlockRegistry, DashboardLabel } from "./dashboard-types";

/** A block's props: the host's settings component, else JSON checked before it applies. */
const props = defineProps<{
  blocks?: DashboardBlockRegistry;
  draft: DashboardWidgetDraft;
  /** The JSON typed (blocks without a settings component). */
  text: string;
  check?: DashboardBlockPropsDraft;
  id: string;
  label: DashboardLabel;
  locale: string;
  widgetId: string;
}>();
const emit = defineEmits<{
  "update:draft": [draft: DashboardWidgetDraft];
  "update:text": [text: string];
}>();

const block = computed(() =>
  props.blocks && props.draft.block && Object.hasOwn(props.blocks, props.draft.block)
    ? props.blocks[props.draft.block]
    : undefined
);
// A registry held in reactive state must not make its components reactive.
const settings = computed(() => (block.value?.settings ? toRaw(block.value.settings) : undefined));
const problems = computed(() =>
  props.check?.issues.filter((issue) => (props.check?.ok ? issue.severity === "warning" : true)) ?? []
);
const changeProps = (next: DashboardJsonObject) => emit("update:draft", { ...props.draft, props: next });
</script>

<template>
  <div class="yayaw-dashboard-block-props" data-block-props="">
    <component
      :is="settings"
      v-if="settings"
      :widget-id="props.widgetId"
      :props="props.draft.props ?? {}"
      :locale="props.locale"
      :on-change="changeProps"
    />
    <div v-else class="yayaw-dashboard-field">
      <label :for="props.id">{{ props.label("blockProps") }}</label>
      <textarea
        :id="props.id"
        class="yayaw-textarea yayaw-dashboard-json"
        rows="8"
        spellcheck="false"
        :aria-invalid="props.check && !props.check.ok ? 'true' : undefined"
        :value="props.text"
        @input="emit('update:text', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
    <p v-if="props.check && !props.check.json" class="yayaw-dashboard-props-error" data-props-error="" role="alert">
      {{ props.label("invalidJson") }}
    </p>
    <div
      v-if="problems.length"
      class="yayaw-dashboard-props-problems"
      data-props-error=""
      :role="props.check?.ok ? undefined : 'alert'"
    >
      <p v-if="!props.check?.ok" class="yayaw-dashboard-props-error">{{ props.label("propsRefused") }}</p>
      <ul>
        <li v-for="issue in problems" :key="`${issue.path ?? ''}:${issue.message}`">
          <template v-if="issue.path"><code>{{ issue.path }}</code>: </template>{{ issue.message }}
        </li>
      </ul>
    </div>
  </div>
</template>
