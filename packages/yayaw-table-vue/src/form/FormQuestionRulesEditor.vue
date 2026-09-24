<script setup lang="ts">
/**
 * A question's conditions: a status line and "Edit conditions", which opens
 * the rules in a dialog (a bottom sheet on phones) where the conditions have
 * room. Changes are reported as they are made.
 */
import { ListFilter, Plus } from "lucide-vue-next";
import { ref } from "vue";
import type { ConditionField, FormRule, RuleIssue } from "../form-conditions";
import type {
  FormLabelKey,
  FormTranslate,
  ResolvedFormQuestion,
} from "../form-view";
import FormRuleEditor from "./FormRuleEditor.vue";
import FormRulesDialog from "./FormRulesDialog.vue";

const props = defineProps<{
  /** The question's name, for the dialog's title. */
  name: string;
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
const open = ref(false);
const issuesOf = (rule: FormRule) =>
  props.issues.filter((issue) => issue.ruleId === rule.id);
</script>

<template>
  <section class="yayaw-form-rules" data-form-rules>
    <h4 class="yayaw-form-rules-heading">{{ label("conditions") }}</h4>
    <p v-if="rules.length === 0" class="yayaw-form-rules-status">{{ label("noConditions") }}</p>
    <p v-if="issues.length" class="yayaw-form-rules-status yayaw-rule-issue" data-form-rules-problem>
      {{ label("conditionsProblem") }}
    </p>
    <button
      type="button"
      class="yayaw-button yayaw-button-outline yayaw-form-settings-add"
      :disabled="fields.length === 0 && rules.length === 0"
      @click="open = true"
    >
      <ListFilter :size="14" aria-hidden="true" />{{ label("editConditions") }}
    </button>
    <FormRulesDialog
      :open="open"
      :title="label('conditionsTitle', { label: name })"
      :description="label('conditionsDescription')"
      :done-label="label('done')"
      :close-label="label('close')"
      @update:open="open = $event"
    >
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
    </FormRulesDialog>
  </section>
</template>
