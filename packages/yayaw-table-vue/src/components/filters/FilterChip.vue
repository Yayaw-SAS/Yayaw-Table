<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import { filterMenuText, filterRuleSummary } from "../../filter-menu";
import type { AdvancedFilter } from "../../types";
import FilterRuleEditor from "./FilterRuleEditor.vue";

/** One rule under the toolbar: "Status: Won, Open"; a click opens its editor. */
const props = defineProps<{ rule: AdvancedFilter }>();
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const column = computed(() => context.config.columns.definitions.find((item) => item.id === props.rule.columnId));
const summary = computed(() =>
  column.value
    ? filterRuleSummary(props.rule, menu.menuColumn(column.value, { yes: filterMenuText("checked", context.locale, translate), no: filterMenuText("unchecked", context.locale, translate) }), context.locale, translate)
    : { property: props.rule.columnId, value: "", complete: false }
);
const open = computed({
  get: () => menu.openId.value === props.rule.id,
  set: (value: boolean) => {
    if (value) menu.openId.value = props.rule.id;
    else if (menu.openId.value === props.rule.id) menu.openId.value = undefined;
  },
});
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button type="button" class="yayaw-filter-chip" :data-complete="summary.complete" :data-filter-chip="rule.columnId" :title="`${summary.property} ${summary.value}`.trim()">
        <span class="yayaw-filter-chip-property">{{ summary.property }}</span>
        <span v-if="summary.value" class="yayaw-filter-chip-value">{{ summary.value }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="yayaw-filter-popover" :data-yayaw-filter-picker="context.config.id" align="start" :side-offset="6" :collision-padding="8" :aria-label="summary.property">
        <FilterRuleEditor :rule="rule" autofocus @update="menu.update" @remove="menu.remove(rule.id)" @advanced="menu.openAdvanced()" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
