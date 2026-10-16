<script setup lang="ts">
import { Check, ChevronDown, ListFilterPlus, MoreHorizontal, Trash2 } from "lucide-vue-next";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import {
  changeFilterOperator,
  filterMenuOperators,
  filterMenuText,
  type FilterMenuTextKey,
  filterOperatorLabel,
} from "../../filter-menu";
import type { AdvancedFilter } from "../../types";
import FilterValueEditor from "./FilterValueEditor.vue";

/** A chip's editor, as in Notion: the property, its operator, ⋯, then the value. */
const props = defineProps<{ rule: AdvancedFilter; autofocus?: boolean }>();
const emit = defineEmits<{ update: [rule: AdvancedFilter]; remove: []; advanced: [] }>();
const context = useTableContext();
const menu = context.filterMenu;
const translate = (key: string): string | undefined => {
  const value = context.translations.value[key];
  return typeof value === "string" ? value : undefined;
};
const text = (key: FilterMenuTextKey): string => filterMenuText(key, context.locale, translate);
const column = computed(() => context.config.columns.definitions.find((item) => item.id === props.rule.columnId));
const type = computed(() => menu.typeOf(column.value));
const folder = computed(() => menu.isFolderColumn(column.value));
const operators = computed(() => filterMenuOperators(type.value, props.rule.operator));
const operatorText = (operator: string): string => filterOperatorLabel(type.value, operator, context.locale, translate);
const pickOperator = (operator: string): void =>
  emit("update", { ...changeFilterOperator(props.rule, operator, type.value), type: type.value });
</script>

<template>
  <div class="yayaw-rule-editor" :data-filter-rule="rule.columnId">
    <div class="yayaw-rule-editor-head">
      <span class="yayaw-rule-editor-name">{{ column?.header ?? rule.columnId }}</span>
      <DropdownMenuRoot v-if="!folder" :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="yayaw-rule-operator" :aria-label="`${text('operator')}: ${operatorText(rule.operator)}`" data-filter-operator="">
            {{ operatorText(rule.operator) }}<ChevronDown :size="12" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-column-menu yayaw-filter-menu-layer" align="start" :side-offset="4" :aria-label="text('operator')">
            <DropdownMenuItem v-for="operator in operators" :key="operator" class="yayaw-column-menu-item" :data-operator="operator" @select="pickOperator(operator)">
              <Check :size="14" aria-hidden="true" :style="{ visibility: operator === rule.operator ? 'visible' : 'hidden' }" />{{ operatorText(operator) }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="yayaw-icon-button yayaw-rule-more" :aria-label="`${column?.header ?? rule.columnId}: ⋯`"><MoreHorizontal :size="16" aria-hidden="true" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-column-menu yayaw-filter-menu-layer" align="end" :side-offset="4">
            <DropdownMenuItem class="yayaw-column-menu-item" data-filter-delete="" @select="emit('remove')"><Trash2 :size="14" aria-hidden="true" />{{ text('deleteFilter') }}</DropdownMenuItem>
            <DropdownMenuItem class="yayaw-column-menu-item" @select="emit('advanced')"><ListFilterPlus :size="14" aria-hidden="true" />{{ text('toAdvanced') }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <FilterValueEditor :rule="rule" :column="column" :autofocus="autofocus" @update="emit('update', $event)" />
  </div>
</template>
