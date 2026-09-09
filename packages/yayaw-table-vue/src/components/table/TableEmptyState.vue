<script setup lang="ts">
import { Inbox, RotateCcw, SearchX } from "lucide-vue-next";
import { computed } from "vue";
import { useTableContext } from "../../context";
import Empty from "../empty/Empty.vue";
import EmptyContent from "../empty/EmptyContent.vue";
import EmptyDescription from "../empty/EmptyDescription.vue";
import EmptyHeader from "../empty/EmptyHeader.vue";
import EmptyMedia from "../empty/EmptyMedia.vue";
import EmptyTitle from "../empty/EmptyTitle.vue";

const context = useTableContext();
const hasActiveFilters = computed(() =>
  context.state.search.value.trim().length > 0 ||
  context.state.filters.value.length > 0 ||
  context.state.advancedFilters.value.filters.some((filter) => filter.isActive !== false)
);
const title = computed(() => context.config.table.emptyState?.title ?? (
  hasActiveFilters.value ? context.translations.value.noResults : context.translations.value.noDataAvailable
));
const description = computed(() => context.config.table.emptyState?.description ?? (
  hasActiveFilters.value ? context.translations.value.noResultsDescription : undefined
));
</script>

<template>
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchX v-if="hasActiveFilters" aria-hidden="true" />
        <Inbox v-else aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{{ title }}</EmptyTitle>
      <EmptyDescription v-if="description">{{ description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="hasActiveFilters">
      <button
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-empty-reset"
        @click="context.state.resetFilters()"
      >
        <RotateCcw :size="16" aria-hidden="true" />
        {{ context.translations.value.clearFilters }}
      </button>
    </EmptyContent>
  </Empty>
</template>
