<script setup lang="ts">
import { Plus, X } from "lucide-vue-next";
import { computed, useId } from "vue";
import {
  type Condition,
  type ConditionField,
  type ConditionGroup,
  type ConditionItem,
  isConditionGroup,
  isCustomCondition,
  type RuleIssue,
  updateConditionAt,
} from "../form-conditions";
import {
  type FormLabelKey,
  type FormTranslate,
  formRuleIssueLabel,
  type ResolvedFormQuestion,
} from "../form-view";
import FormRuleCondition from "./FormRuleCondition.vue";
import FormRuleJoin from "./FormRuleJoin.vue";

defineOptions({ name: "FormRuleGroup" });

/**
 * The conditions of a group. The rule's own group lists its items; a nested
 * group is an indented card with its All/Any toggle, removal and
 * "Add condition".
 */
const props = defineProps<{
  group: ConditionGroup;
  path: number[];
  nested?: boolean;
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
  locale: string;
  questions?: readonly ResolvedFormQuestion[];
  translate?: FormTranslate;
}>();
const emit = defineEmits<{ change: [group: ConditionGroup]; remove: [] }>();
const titleId = useId();

const emptyIssue = computed(() =>
  props.issues.find(
    (issue) =>
      issue.code === "emptyGroup" &&
      JSON.stringify(issue.path ?? []) === JSON.stringify(props.path)
  )
);
const update = (index: number, next: ConditionItem | undefined): void =>
  emit("change", updateConditionAt(props.group, [index], () => next));
const itemKey = (item: ConditionItem, index: number): string =>
  `${[...props.path, index].join(".")}-${isConditionGroup(item) ? "group" : "condition"}`;
const asCondition = (item: ConditionItem): Condition => item as Condition;
const addCondition = (): void =>
  emit("change", {
    ...props.group,
    items: [...props.group.items, { fieldId: "", operator: "is" }],
  });
</script>

<template>
  <section v-if="nested" class="yayaw-rule-group" :aria-labelledby="titleId" :data-rule-group="path.join('.')">
    <div class="yayaw-rule-group-header">
      <span :id="titleId" class="yayaw-rule-group-title">{{ label("ruleGroup") }}</span>
      <FormRuleJoin :join="group.join" :label="label" quiet-legend @change="emit('change', { ...group, join: $event })" />
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-rule-remove"
        :aria-label="label('removeGroup')"
        @click="emit('remove')"
      >
        <X :size="12" aria-hidden="true" />
      </button>
    </div>
    <template v-for="(item, index) in group.items" :key="itemKey(item, index)">
      <FormRuleCondition
        v-if="!isConditionGroup(item) && !isCustomCondition(item)"
        :condition="asCondition(item)"
        :path="[...path, index]"
        :fields="fields"
        :issues="issues"
        :label="label"
        :locale="locale"
        :questions="questions"
        :translate="translate"
        @change="update(index, $event)"
        @remove="update(index, undefined)"
      />
    </template>
    <p v-if="emptyIssue" class="yayaw-rule-issue" :data-rule-issue="emptyIssue.code">
      {{ label(formRuleIssueLabel(emptyIssue.code)) }}
    </p>
    <button type="button" class="yayaw-button yayaw-button-ghost yayaw-rule-add" @click="addCondition">
      <Plus :size="12" aria-hidden="true" />{{ label("addCondition") }}
    </button>
  </section>
  <template v-else>
    <template v-for="(item, index) in group.items" :key="itemKey(item, index)">
      <FormRuleGroup
        v-if="isConditionGroup(item)"
        nested
        :group="item"
        :path="[...path, index]"
        :fields="fields"
        :issues="issues"
        :label="label"
        :locale="locale"
        :questions="questions"
        :translate="translate"
        @change="update(index, $event)"
        @remove="update(index, undefined)"
      />
      <FormRuleCondition
        v-else-if="!isCustomCondition(item)"
        :condition="asCondition(item)"
        :path="[...path, index]"
        :fields="fields"
        :issues="issues"
        :label="label"
        :locale="locale"
        :questions="questions"
        :translate="translate"
        @change="update(index, $event)"
        @remove="update(index, undefined)"
      />
    </template>
  </template>
</template>
