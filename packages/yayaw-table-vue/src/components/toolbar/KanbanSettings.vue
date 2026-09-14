<script setup lang="ts">
import { useKanbanSettings } from "../../composables/use-kanban-settings";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";
const {
  translate,
  columnOptions,
  titleColumn,
  propertyIds,
  showLabels,
  groupBy,
} = useKanbanSettings();
</script>
<template>
  <ViewSettingsPanel
    :fields="[
      {
        id: 'title',
        label: translate('cardTitle', 'Title'),
        value: titleColumn,
        options: columnOptions.filter((option) => option.value !== groupBy),
        onChange: (value) => (titleColumn = value),
      },
    ]"
    :properties="{
      label: translate('properties', 'Properties'),
      options: columnOptions.filter(
        (option) => ![groupBy, titleColumn].includes(option.value),
      ),
      value: propertyIds,
      onChange: (value) => (propertyIds = value),
      showLabels,
      showLabelsLabel: translate('cardShowLabels', 'Show labels'),
      onShowLabelsChange: (value) => (showLabels = value),
    }"
  />
</template>
