<script setup lang="ts">
import { useGallerySettings } from "../../composables/use-gallery-settings";
import TableSelect from "../controls/TableSelect.vue";
import CardPropertiesMenu from "../controls/CardPropertiesMenu.vue";
const { translate, columnOptions, titleColumn, propertyIds, showLabels, imageOptions, ratioOptions, fitOptions, sizeOptions, imageColumn, aspectRatio, imageFit, cardSize } = useGallerySettings();
</script>
<template>
    <div class="yayaw-card-settings">
      <TableSelect v-model="imageColumn" :label="translate('cardImage', 'Image')" :options="imageOptions" />
      <TableSelect v-model="titleColumn" :label="translate('cardTitle', 'Title')" :options="columnOptions" />
      <TableSelect v-model="aspectRatio" :label="translate('cardRatio', 'Ratio')" :options="ratioOptions" />
      <TableSelect v-model="imageFit" :label="translate('cardFit', 'Fit')" :options="fitOptions" />
      <TableSelect v-model="cardSize" :label="translate('cardSize', 'Size')" :options="sizeOptions" />
      <CardPropertiesMenu v-model="propertyIds" v-model:show-labels="showLabels" :label="translate('properties', 'Properties')" :show-labels-label="translate('cardShowLabels', 'Show labels')" :options="columnOptions" />
    </div>
</template>
