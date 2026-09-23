<script setup lang="ts">
import { Plus, Trash2 } from "lucide-vue-next";
import { computed } from "vue";
import {
  type ConditionField,
  type ConditionGroup,
  type FormRule,
  type FormRuleAction,
  isConditionGroup,
  type RuleIssue,
} from "../form-conditions";
import {
  type FormLabelKey,
  type FormTranslate,
  formRuleIssueLabel,
  type ResolvedFormQuestion,
} from "../form-view";
import FormRuleGroup from "./FormRuleGroup.vue";
import FormRuleJoin from "./FormRuleJoin.vue";
import FormRuleSelect from "./FormRuleSelect.vue";

/**
 * One rule of a question in the Form settings: "Show this question when…",
 * its conditions (All/Any, one nested group), problems and removal. Rules
 * are saved with the view (`config.form.rules`).
 */
const props = defineProps<{
  rule: FormRule;
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
  locale: string;
  questions?: readonly ResolvedFormQuestion[];
  translate?: FormTranslate;
}>();
const emit = defineEmits<{ change: [rule: FormRule]; remove: [] }>();

const actions = computed(() => [
  { value: "show", label: props.label("actionShow") },
  { value: "hide", label: props.label("actionHide") },
  { value: "require", label: props.label("actionRequire") },
]);
const ruleIssue = computed(() =>
  props.issues.find(
    (issue) =>
      !issue.path || (issue.code === "emptyGroup" && issue.path.length === 0)
  )
);
const hasGroup = computed(() => props.rule.when.items.some(isConditionGroup));
const setWhen = (when: ConditionGroup): void =>
  emit("change", { ...props.rule, when });
const addCondition = (): void =>
  setWhen({
    ...props.rule.when,
    items: [...props.rule.when.items, { fieldId: "", operator: "is" }],
  });
const addGroup = (): void =>
  setWhen({
    ...props.rule.when,
    items: [
      ...props.rule.when.items,
      {
        join: props.rule.when.join === "and" ? "or" : "and",
        items: [{ fieldId: "", operator: "is" }],
      },
    ],
  });
</script>

<template>
  <div class="yayaw-rule" :data-form-rule="rule.id">
    <div class="yayaw-rule-row">
      <FormRuleSelect
        :label="label('ruleAction')"
        :value="rule.then.action"
        :options="actions"
        @change="emit('change', { ...rule, then: { ...rule.then, action: $event as FormRuleAction } })"
      />
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
        :aria-label="label('removeRule')"
        @click="emit('remove')"
      >
        <Trash2 :size="14" aria-hidden="true" />
      </button>
    </div>
    <FormRuleJoin
      v-if="rule.when.items.length > 1"
      :join="rule.when.join"
      :label="label"
      @change="setWhen({ ...rule.when, join: $event })"
    />
    <FormRuleGroup
      :group="rule.when"
      :path="[]"
      :fields="fields"
      :issues="issues"
      :label="label"
      :locale="locale"
      :questions="questions"
      :translate="translate"
      @change="setWhen"
    />
    <p v-if="ruleIssue" class="yayaw-rule-issue" :data-rule-issue="ruleIssue.code">
      {{ label(formRuleIssueLabel(ruleIssue.code)) }}
    </p>
    <div class="yayaw-rule-buttons">
      <button type="button" class="yayaw-button yayaw-button-ghost yayaw-rule-add" @click="addCondition">
        <Plus :size="12" aria-hidden="true" />{{ label("addCondition") }}
      </button>
      <button v-if="!hasGroup" type="button" class="yayaw-button yayaw-button-ghost yayaw-rule-add" @click="addGroup">
        <Plus :size="12" aria-hidden="true" />{{ label("addGroup") }}
      </button>
    </div>
  </div>
</template>
