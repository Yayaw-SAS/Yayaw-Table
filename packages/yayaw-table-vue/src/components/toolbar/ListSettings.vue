<script setup lang="ts">
import { useListSettings } from "../../composables/use-list-settings";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";
const { translate, columnOptions, titleColumn, propertyIds, showLabels } =
  useListSettings();
</script>
<template>
  <ViewSettingsPanel
    :fields="[
      {
        id: 'title',
        label: translate('cardTitle', 'Title'),
        value: titleColumn,
        options: columnOptions,
        onChange: (value) => (titleColumn = value),
      },
    ]"
    :properties="{
      label: translate('properties', 'Properties'),
      options: columnOptions.filter((option) => option.value !== titleColumn),
      value: propertyIds,
      onChange: (value) => (propertyIds = value),
      showLabels,
      showLabelsLabel: translate('cardShowLabels', 'Show labels'),
      onShowLabelsChange: (value) => (showLabels = value),
    }"
  />
</template>
