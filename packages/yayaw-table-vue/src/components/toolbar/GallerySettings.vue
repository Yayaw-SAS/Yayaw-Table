<script setup lang="ts">
import { useGallerySettings } from "../../composables/use-gallery-settings";
import ViewSettingsPanel from "../controls/ViewSettingsPanel.vue";
const {
  context,
  translate,
  columnOptions,
  titleColumn,
  propertyIds,
  showLabels,
  imageOptions,
  ratioOptions,
  fitOptions,
  sizeOptions,
  imageColumn,
  aspectRatio,
  imageFit,
  cardSize,
  previewSize,
} = useGallerySettings();
</script>
<template>
  <div class="yayaw-card-settings">
    <ViewSettingsPanel
      :fields="[
        {
          id: 'image',
          label: translate('cardImage', 'Image'),
          value: imageColumn,
          options: imageOptions,
          onChange: (value) => (imageColumn = value),
        },
        {
          id: 'title',
          label: translate('cardTitle', 'Title'),
          value: titleColumn,
          options: columnOptions.filter(
            (option) => option.value !== imageColumn,
          ),
          onChange: (value) => (titleColumn = value),
        },
        {
          id: 'ratio',
          label: translate('cardRatio', 'Ratio'),
          value: aspectRatio,
          options: ratioOptions,
          onChange: (value) =>
            (aspectRatio =
              ratioOptions.find((option) => option.value === value)?.value ??
              aspectRatio),
        },
        {
          id: 'fit',
          label: translate('cardFit', 'Fit'),
          value: imageFit,
          options: fitOptions,
          onChange: (value) =>
            (imageFit =
              fitOptions.find((option) => option.value === value)?.value ??
              imageFit),
        },
        {
          id: 'previewSize',
          label: translate('cardPreviewSize', 'Preview size'),
          value: previewSize,
          options: [{value: 'small', label: 'S'}, {value: 'medium', label: 'M'}, {value: 'large', label: 'L'}],
          onChange: value => previewSize = sizeOptions.find(option => option.value === value)?.value ?? previewSize,
        },
        {
          id: 'size',
          label: translate('cardSize', 'Size'),
          value: cardSize,
          options: sizeOptions,
          onChange: (value) =>
            (cardSize =
              sizeOptions.find((option) => option.value === value)?.value ??
              cardSize),
        },
      ]"
      :properties="{
        label: translate('properties', 'Properties'),
        options: columnOptions.filter(
          (option) => ![imageColumn, titleColumn].includes(option.value),
        ),
        value: propertyIds,
        onChange: (value) => (propertyIds = value),
        showLabels,
        showLabelsLabel: translate('cardShowLabels', 'Show labels'),
        onShowLabelsChange: (value) => (showLabels = value),
      }"
    >
      <button
        type="button"
        class="yayaw-button yayaw-button-outline"
        :disabled="Object.keys(context.state.gallery.value).length === 0"
        @click="context.state.gallery.value = {}"
      >
        {{ translate("reset", "Reset") }}
      </button>
    </ViewSettingsPanel>
  </div>
</template>
