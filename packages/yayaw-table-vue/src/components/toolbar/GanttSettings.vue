<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "../../context";
import { ganttSettingsLabels } from "../../planning/settings";
import type { TableGanttViewConfig } from "../../planning/types";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";
import TableCheckbox from "../controls/TableCheckbox.vue";
const context = useTableContext();
const labels = computed(() => ganttSettingsLabels(context.locale));
const view = computed(() => ({
  ...context.config.table.gantt,
  ...context.state.gantt.value,
}));
const update = (patch: TableGanttViewConfig) => {
  context.state.gantt.value = { ...context.state.gantt.value, ...patch };
};
</script>
<template>
  <div class="yayaw-card-settings">
    <ViewSettingsPanel
      :fields="[
        {
          id: 'zoom',
          label: labels.zoom,
          value: view.zoom ?? 'week',
          options: labels.zoomOptions,
          onChange: (value) =>
            update({ zoom: value as TableGanttViewConfig['zoom'] }),
        },
        {
          id: 'week-start',
          label: labels.weekStart,
          value: String(view.weekStartsOn ?? 1),
          options: labels.weekOptions,
          onChange: (value) => update({ weekStartsOn: Number(value) }),
        },
      ]"
    >
      <label class="yayaw-settings-choice">
        <TableCheckbox
          :label="labels.showDependencies"
          :model-value="view.showDependencies !== false"
          @update:model-value="update({ showDependencies: $event })"
        /><span>{{ labels.showDependencies }}</span>
      </label>
    </ViewSettingsPanel>
  </div>
</template>
