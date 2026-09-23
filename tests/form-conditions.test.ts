import { test } from "bun:test";
import {
  applyFormEvaluation,
  conditionFieldType,
  describeRule,
  detectRuleCycles,
  evaluateForm,
  matchCondition,
  normalizeRules,
  predicateRule,
  rulesReading,
  sanitizeRules,
  validateRules,
} from "../src/components/ui/yayaw-table/utils/form-conditions";
import { formConditionsSuite } from "./form-conditions-suite";

formConditionsSuite(test, {
  applyFormEvaluation,
  conditionFieldType,
  describeRule,
  detectRuleCycles,
  evaluateForm,
  matchCondition,
  normalizeRules,
  predicateRule,
  rulesReading,
  sanitizeRules,
  validateRules,
});
