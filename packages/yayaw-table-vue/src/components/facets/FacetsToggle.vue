<script setup lang="ts">
import { ListFilter, PanelLeft, PanelRight } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import { useFacets } from "../../composables/use-facets";
import TableTooltip from "../toolbar/TableTooltip.vue";
import ToolbarMenu from "../toolbar/ToolbarMenu.vue";
import FacetPanel from "./FacetPanel.vue";

/** The toolbar button showing and hiding the facet panel; on phones it opens the panel as a sheet. */
const props = defineProps<{ compact: boolean }>();
const context = useTableContext();
const { facets, label, open, selectedCount, shown } = useFacets();
const sheetOpen = ref(false);
const text = computed(() =>
  props.compact || !open.value ? label("show") : label("hide")
);
</script>

<template>
  <template v-if="facets && shown">
    <ToolbarMenu v-if="compact" v-model:open="sheetOpen" compact :title="label('title')" :close-label="label('close')">
      <template #trigger>
        <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only yayaw-facets-toggle" data-facets-toggle="" :aria-label="text">
          <ListFilter :size="16" aria-hidden="true" />
          <span v-if="selectedCount" class="yayaw-settings-badge" aria-hidden="true">{{ selectedCount }}</span>
        </button>
      </template>
      <div class="yayaw-facets-sheet" data-facet-sheet="">
        <FacetPanel :heading-id="`${context.config.id}-facets-sheet-title`" sheet />
      </div>
    </ToolbarMenu>
    <TableTooltip v-else :label="text">
      <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only yayaw-facets-toggle" data-facets-toggle="" :aria-label="text" :aria-pressed="open" :aria-controls="open ? `${context.config.id}-facets` : undefined" @click="open = !open">
        <PanelRight v-if="facets.position === 'right'" :size="16" aria-hidden="true" />
        <PanelLeft v-else :size="16" aria-hidden="true" />
        <span v-if="selectedCount" class="yayaw-settings-badge" aria-hidden="true">{{ selectedCount }}</span>
      </button>
    </TableTooltip>
  </template>
</template>
