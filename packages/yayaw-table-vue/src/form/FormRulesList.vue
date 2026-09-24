<script setup lang="ts">
/**
 * A question's rules, each in its editor, then "Add a condition": the body of
 * the conditions dialog, and the conditions of the form builder's properties.
 */
import { Plus } from "lucide-vue-next";
import type { ConditionField, FormRule, RuleIssue } from "../form-conditions";
import type {
  FormLabelKey,
  FormTranslate,
  ResolvedFormQuestion,
} from "../form-view";
import FormRuleEditor from "./FormRuleEditor.vue";

const props = defineProps<{
  /** The rules acting on the question. */
  rules: readonly FormRule[];
  /** Questions its conditions may read. */
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  questions: readonly ResolvedFormQuestion[];
  locale: string;
  translate?: FormTranslate;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{
  add: [];
  change: [rule: FormRule];
  remove: [ruleId: string];
}>();
const issuesOf = (rule: FormRule) =>
  props.issues.filter((issue) => issue.ruleId === rule.id);
</script>

<template>
  <FormRuleEditor
    v-for="rule in rules"
    :key="rule.id"
    :rule="rule"
    :fields="fields"
    :issues="issuesOf(rule)"
    :label="label"
    :locale="locale"
    :questions="questions"
    :translate="translate"
    @change="emit('change', $event)"
    @remove="emit('remove', rule.id)"
  />
  <p v-if="rules.length === 0" class="yayaw-form-rules-empty">{{ label("noConditions") }}</p>
  <button
    type="button"
    class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
    :disabled="fields.length === 0"
    @click="emit('add')"
  >
    <Plus :size="14" aria-hidden="true" />{{ label("addRule") }}
  </button>
</template>
