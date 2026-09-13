<script setup lang="ts">
import { useKanbanSettings } from "../../composables/use-kanban-settings";
import TableSelect from "../controls/TableSelect.vue";
import CardPropertiesMenu from "../controls/CardPropertiesMenu.vue";
const { translate, columnOptions, titleColumn, propertyIds, showLabels } = useKanbanSettings();
</script>
<template>
    <div class="yayaw-card-settings">
      <TableSelect v-model="titleColumn" :label="translate('cardTitle', 'Title')" :options="columnOptions" />
      <CardPropertiesMenu v-model="propertyIds" v-model:show-labels="showLabels" :label="translate('properties', 'Properties')" :show-labels-label="translate('cardShowLabels', 'Show labels')" :options="columnOptions" />
    </div>
</template>
