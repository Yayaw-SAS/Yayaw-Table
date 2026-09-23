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
  type RuleIssueCode,
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
  type ResolvedFormQuestion,
} from "../form-view";
import { tagAppearance } from "../tag-colors";
import FormDateField from "./FormDateField.vue";
import FormRuleInput from "./FormRuleInput.vue";
import FormRuleSelect, { type RuleOption } from "./FormRuleSelect.vue";

/**
 * One condition of a rule, as a card: question, then comparison and value
 * (side by side from 18rem, all three in a row from 34rem, by container
 * queries), removal at the top right and its problem.
 */
const props = defineProps<{
  condition: Condition;
  path: number[];
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
  locale: string;
  questions?: readonly ResolvedFormQuestion[];
  translate?: FormTranslate;
}>();
const emit = defineEmits<{ change: [condition: Condition]; remove: [] }>();
const id = useId();

/** Which control of a condition a problem is about. */
const ISSUE_TARGET: Partial<Record<RuleIssueCode, "field" | "operator" | "value">> = {
  missingField: "field",
  unknownField: "field",
  selfReference: "field",
  laterQuestion: "field",
  operator: "operator",
  missingValue: "value",
  unknownOption: "value",
};

const field = computed(() =>
  props.fields.find((item) => item.id === props.condition.fieldId)
);
const kind = computed(() => operatorValueKind(props.condition.operator));
const hasValue = computed(() => Boolean(field.value) && kind.value !== "none");
const wideValue = computed(() => kind.value === "list" || kind.value === "range");
const inputType = computed(() => formRuleInputType(field.value));
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
const choices = computed<RuleOption[]>(() => {
  const question = props.questions?.find((item) => item.id === field.value?.id);
  return (field.value?.options ?? []).map((option) => {
    const value = String(option.value);
    return {
      value,
      label: option.label,
      tag: question?.tags ? tagAppearance(value, question.coloredTags) : undefined,
    };
  });
});
const selected = computed(() => formRuleList(props.condition.value));
const ends = computed(() =>
  Array.isArray(props.condition.value) ? props.condition.value : [null, null]
);
const issue = computed(() =>
  props.issues.find(
    (item) => JSON.stringify(item.path ?? []) === JSON.stringify(props.path)
  )
);
const issueId = computed(() => (issue.value ? `${id}-issue` : undefined));
const invalid = (name: "field" | "operator" | "value"): boolean =>
  Boolean(issue.value && ISSUE_TARGET[issue.value.code] === name);

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
const ranges = computed(() => [
  { index: 0 as const, key: "ruleFrom" as const, value: ends.value[0] },
  { index: 1 as const, key: "ruleTo" as const, value: ends.value[1] },
]);
</script>

<template>
  <div class="yayaw-rule-condition" :data-rule-condition="path.join('.')">
    <div class="yayaw-rule-card">
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-rule-remove"
        :aria-label="label('removeCondition')"
        @click="emit('remove')"
      >
        <X :size="12" aria-hidden="true" />
      </button>
      <FormRuleSelect
        :label="label('ruleField')"
        :placeholder="label('chooseQuestion')"
        :value="condition.fieldId"
        :options="fieldOptions"
        :described-by="issueId"
        :invalid="invalid('field')"
        @change="retarget"
      />
      <div class="yayaw-rule-compare">
        <div class="yayaw-rule-operator" :data-alone="!hasValue || undefined" :data-wide="(hasValue && wideValue) || undefined">
          <FormRuleSelect
            :label="label('ruleOperator')"
            :value="field ? condition.operator : ''"
            :options="operatorOptions"
            :described-by="issueId"
            :invalid="invalid('operator')"
            @change="emit('change', withOperator(condition, $event as ConditionOperator))"
          />
        </div>
        <div v-if="field && hasValue" class="yayaw-rule-value" :data-wide="wideValue || undefined">
          <fieldset v-if="kind === 'list' && choices.length" class="yayaw-rule-choices" :aria-describedby="issueId">
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
              <label :for="`${id}-${index}`">
                <span
                  v-if="choice.tag"
                  class="yayaw-tag"
                  :class="choice.tag.className"
                  :data-colored="choice.tag.colored"
                  :style="choice.tag.style"
                >{{ choice.label }}</span>
                <template v-else>{{ choice.label }}</template>
              </label>
            </div>
          </fieldset>
          <FormRuleInput
            v-else-if="kind === 'list'"
            :label="label('ruleValue')"
            :type="field.type === 'number' ? 'number' : 'text'"
            :value="selected.join(', ')"
            :described-by="issueId"
            :invalid="invalid('value')"
            @commit="setValue(formRuleListFrom($event))"
          />
          <div v-else-if="kind === 'range'" class="yayaw-rule-range">
            <template v-for="end in ranges" :key="end.key">
              <span v-if="inputType === 'date'" class="yayaw-rule-date">
                <span :id="`${id}-${end.key}-label`" class="yayaw-sr-only">{{ label(end.key) }}</span>
                <FormDateField
                  :id="`${id}-${end.key}`"
                  :label-id="`${id}-${end.key}-label`"
                  :value="formRuleValueText(end.value)"
                  :locale="locale"
                  :placeholder="label('pickDate')"
                  :clear-label="label('clearDate')"
                  :described-by="issueId"
                  :invalid="invalid('value')"
                  @change="setValue(formRuleRange(field, condition.value, end.index, $event))"
                />
              </span>
              <FormRuleInput
                v-else
                :label="label(end.key)"
                :type="inputType === 'number' ? 'number' : 'text'"
                :value="formRuleValueText(end.value)"
                :described-by="issueId"
                :invalid="invalid('value')"
                @commit="setValue(formRuleRange(field, condition.value, end.index, $event))"
              />
            </template>
          </div>
          <FormRuleSelect
            v-else-if="kind === 'single' && field.type === 'select' && choices.length"
            :label="label('ruleValue')"
            :placeholder="label('choose')"
            :value="formRuleValueText(condition.value)"
            :options="choices"
            :described-by="issueId"
            :invalid="invalid('value')"
            @change="setValue($event)"
          />
          <span v-else-if="kind === 'single' && inputType === 'date'" class="yayaw-rule-date">
            <span :id="`${id}-value-label`" class="yayaw-sr-only">{{ label("ruleValue") }}</span>
            <FormDateField
              :id="`${id}-value`"
              :label-id="`${id}-value-label`"
              :value="formRuleValueText(condition.value)"
              :locale="locale"
              :placeholder="label('pickDate')"
              :clear-label="label('clearDate')"
              :described-by="issueId"
              :invalid="invalid('value')"
              @change="setValue(formRuleValue(field, $event))"
            />
          </span>
          <FormRuleInput
            v-else
            :label="kind === 'days' ? label('ruleDays') : label('ruleValue')"
            :type="kind === 'days' || field.type === 'number' ? 'number' : 'text'"
            :unit="kind === 'days' ? label('ruleDaysUnit') : undefined"
            :value="formRuleValueText(condition.value)"
            :described-by="issueId"
            :invalid="invalid('value')"
            @commit="setValue(formRuleValue(field, $event, kind === 'days'))"
          />
        </div>
      </div>
      <p v-if="issue" :id="issueId" class="yayaw-rule-issue" :data-rule-issue="issue.code">
        {{ label(formRuleIssueLabel(issue.code)) }}
      </p>
    </div>
  </div>
</template>
