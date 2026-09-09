<script setup lang="ts">
import { Calculator, Check, ChevronRight } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import type { CalculationType } from "../../types";

const props = defineProps<{
  columnLabel: string;
  options: CalculationType[];
  result?: string;
}>();
const calculation = defineModel<CalculationType>({ default: "none" });
const context = useTableContext();
const translate = (key: string): string =>
  String(context.translations.value[`calculations.${key}`] ?? key);
const label = computed(() => `${translate("calculate")}: ${props.columnLabel}`);
const groups = computed(() =>
  [
    {
      key: "count",
      items: props.options.filter((option) => option.startsWith("count_")),
    },
    {
      key: "percent",
      items: props.options.filter((option) => option.startsWith("percent_")),
    },
    {
      key: "more",
      items: props.options.filter((option) =>
        option !== "none" &&
        !option.startsWith("count_") &&
        !option.startsWith("percent_")
      ),
    },
  ].filter((group) => group.items.length)
);
const selectCalculation = (value: unknown): void => {
  const option = props.options.find((item) => item === value);
  if (option) {
    calculation.value = option;
  }
};
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="yayaw-calculation-trigger" :aria-label="label">
        <span v-if="calculation === 'none'" class="yayaw-calculation-empty">
          <Calculator :size="14" aria-hidden="true" />{{ translate("calculate") }}
        </span>
        <template v-else>
          <small>{{ translate(calculation) }}</small>
          <strong>{{ result }}</strong>
        </template>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="yayaw-column-menu yayaw-calculation-menu" align="start" side="top" :side-offset="4" :collision-padding="8" :aria-label="label">
        <DropdownMenuRadioGroup :model-value="calculation" @update:model-value="selectCalculation">
          <DropdownMenuRadioItem value="none" class="yayaw-column-menu-item yayaw-calculation-option">
            {{ translate("none") }}
            <DropdownMenuItemIndicator><Check :size="16" aria-hidden="true" /></DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub v-for="group in groups" :key="group.key">
          <DropdownMenuSubTrigger class="yayaw-column-menu-item yayaw-calculation-option">
            {{ translate(group.key) }}<ChevronRight :size="16" aria-hidden="true" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent class="yayaw-column-menu yayaw-calculation-menu" :side-offset="4" :collision-padding="8" :aria-label="translate(group.key)">
              <DropdownMenuRadioGroup :model-value="calculation" @update:model-value="selectCalculation">
                <DropdownMenuRadioItem v-for="option in group.items" :key="option" :value="option" class="yayaw-column-menu-item yayaw-calculation-option">
                  {{ translate(option) }}
                  <DropdownMenuItemIndicator><Check :size="16" aria-hidden="true" /></DropdownMenuItemIndicator>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
