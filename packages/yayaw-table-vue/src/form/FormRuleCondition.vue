<script setup lang="ts">
import { Check, X } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { computed, useId } from "vue";
import {
  CONDITION_OPERATORS,
  type Condition,
  type ConditionField,
  type ConditionOperator,
  type ConditionValue,
  operatorValueKind,
  type RuleIssue,
  retargetCondition,
  withOperator,
} from "../form-conditions";
import {
  type FormLabelKey,
  type FormTranslate,
  formOperatorLabel,
  formRuleInputType,
  formRuleIssueLabel,
  formRuleList,
  formRuleListFrom,
  formRuleRange,
  formRuleValue,
  formRuleValueText,
} from "../form-view";
import FormRuleInput from "./FormRuleInput.vue";
import FormRuleSelect from "./FormRuleSelect.vue";

/** One condition of a rule: question, comparison, value and its problem. */
const props = defineProps<{
  condition: Condition;
  path: number[];
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
  locale: string;
  translate?: FormTranslate;
}>();
const emit = defineEmits<{ change: [condition: Condition]; remove: [] }>();
const id = useId();

const field = computed(() =>
  props.fields.find((item) => item.id === props.condition.fieldId)
);
const kind = computed(() => operatorValueKind(props.condition.operator));
const fieldOptions = computed(() =>
  props.fields.map((item) => ({ value: item.id, label: item.label ?? item.id }))
);
const operatorOptions = computed(() =>
  (field.value ? CONDITION_OPERATORS[field.value.type] : []).map(
    (operator) => ({
      value: operator,
      label: formOperatorLabel(operator, props.locale, props.translate),
    })
  )
);
const choices = computed(() =>
  (field.value?.options ?? []).map((option) => ({
    value: String(option.value),
    label: option.label,
  }))
);
const selected = computed(() => formRuleList(props.condition.value));
const ends = computed(() =>
  Array.isArray(props.condition.value) ? props.condition.value : [null, null]
);
const issue = computed(() =>
  props.issues.find(
    (item) => JSON.stringify(item.path ?? []) === JSON.stringify(props.path)
  )
);

const setValue = (value: ConditionValue): void =>
  emit("change", { ...props.condition, value });
const retarget = (fieldId: string): void =>
  emit(
    "change",
    retargetCondition(
      props.condition,
      props.fields.find((item) => item.id === fieldId)
    )
  );
const toggle = (value: string, checked: boolean): void =>
  setValue(
    checked
      ? [...selected.value, value]
      : selected.value.filter((item) => item !== value)
  );
</script>

<template>
  <div class="yayaw-rule-condition" :data-rule-condition="path.join('.')">
    <FormRuleSelect
      :label="label('ruleField')"
      :placeholder="label('chooseQuestion')"
      :value="condition.fieldId"
      :options="fieldOptions"
      @change="retarget"
    />
    <FormRuleSelect
      :label="label('ruleOperator')"
      :value="field ? condition.operator : ''"
      :options="operatorOptions"
      @change="emit('change', withOperator(condition, $event as ConditionOperator))"
    />
    <button
      type="button"
      class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
      :aria-label="label('removeCondition')"
      @click="emit('remove')"
    >
      <X :size="14" aria-hidden="true" />
    </button>
    <template v-if="field && kind !== 'none'">
      <fieldset v-if="kind === 'list' && choices.length" class="yayaw-rule-choices">
        <legend class="yayaw-sr-only">{{ label("ruleValue") }}</legend>
        <div v-for="(choice, index) in choices" :key="choice.value" class="yayaw-rule-choice">
          <CheckboxRoot
            :id="`${id}-${index}`"
            class="yayaw-checkbox"
            :model-value="selected.includes(choice.value)"
            @update:model-value="toggle(choice.value, $event === true)"
          >
            <CheckboxIndicator class="yayaw-checkbox-indicator">
              <Check :size="14" aria-hidden="true" />
            </CheckboxIndicator>
          </CheckboxRoot>
          <label :for="`${id}-${index}`">{{ choice.label }}</label>
        </div>
      </fieldset>
      <div v-else-if="kind === 'list'" class="yayaw-rule-value">
        <FormRuleInput
          :label="label('ruleValue')"
          type="text"
          :value="selected.join(', ')"
          @commit="setValue(formRuleListFrom($event))"
        />
      </div>
      <div v-else-if="kind === 'range'" class="yayaw-rule-value yayaw-rule-range">
        <FormRuleInput
          :label="label('ruleFrom')"
          :type="formRuleInputType(field)"
          :value="formRuleValueText(ends[0])"
          @commit="setValue(formRuleRange(field, condition.value, 0, $event))"
        />
        <FormRuleInput
          :label="label('ruleTo')"
          :type="formRuleInputType(field)"
          :value="formRuleValueText(ends[1])"
          @commit="setValue(formRuleRange(field, condition.value, 1, $event))"
        />
      </div>
      <div v-else-if="kind === 'single' && field.type === 'select' && choices.length" class="yayaw-rule-value">
        <FormRuleSelect
          :label="label('ruleValue')"
          :placeholder="label('ruleValue')"
          :value="formRuleValueText(condition.value)"
          :options="choices"
          @change="setValue($event)"
        />
      </div>
      <div v-else class="yayaw-rule-value">
        <FormRuleInput
          :label="kind === 'days' ? label('ruleDays') : label('ruleValue')"
          :type="kind === 'days' ? 'number' : formRuleInputType(field)"
          :value="formRuleValueText(condition.value)"
          @commit="setValue(formRuleValue(field, $event, kind === 'days'))"
        />
      </div>
    </template>
    <p v-if="issue" class="yayaw-rule-issue" :data-rule-issue="issue.code">
      {{ label(formRuleIssueLabel(issue.code)) }}
    </p>
  </div>
</template>
