<script setup lang="ts">
import { useListSettings } from "../../composables/use-list-settings";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";
const {
  translate,
  columnOptions,
  titleColumn,
  propertyIds,
  showLabels,
  wrap,
  showActions,
  propertyAlign,
  maxProperties,
  mobileMaxProperties,
} = useListSettings();
const countOptions = (max: number) => [
  { value: "", label: translate("list.all", "All") },
  ...Array.from({ length: max + 1 }, (_, count) => ({
    value: String(count),
    label: String(count),
  })),
];
const toCount = (value: string): number | undefined =>
  value === "" ? undefined : Number(value);
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
      {
        id: 'wrap',
        label: translate('list.title', 'Title'),
        value: wrap ? 'wrap' : 'truncate',
        options: [
          { value: 'truncate', label: translate('list.truncate', 'One line') },
          { value: 'wrap', label: translate('list.wrap', 'Wrap') },
        ],
        onChange: (value) => (wrap = value === 'wrap'),
      },
      {
        id: 'align',
        label: translate('list.propertyAlign', 'Properties'),
        value: propertyAlign,
        options: [
          { value: 'end', label: translate('list.alignEnd', 'End of line') },
          { value: 'start', label: translate('list.alignStart', 'After title') },
        ],
        onChange: (value) => (propertyAlign = value === 'start' ? 'start' : 'end'),
      },
      {
        id: 'maxProperties',
        label: translate('list.maxProperties', 'Properties shown'),
        value: String(maxProperties ?? ''),
        options: countOptions(6),
        onChange: (value) => (maxProperties = toCount(value)),
      },
      {
        id: 'mobileMaxProperties',
        label: translate('list.mobileMaxProperties', 'Properties on mobile'),
        value: String(mobileMaxProperties ?? ''),
        options: countOptions(4),
        onChange: (value) => (mobileMaxProperties = toCount(value)),
      },
      {
        id: 'actions',
        label: translate('list.actions', 'Row actions'),
        value: showActions ? 'show' : 'hide',
        options: [
          { value: 'show', label: translate('list.show', 'Shown') },
          { value: 'hide', label: translate('list.hide', 'Hidden') },
        ],
        onChange: (value) => (showActions = value === 'show'),
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
