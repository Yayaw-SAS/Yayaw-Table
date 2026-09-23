import { it } from "vitest";
import { formConditionsSuite } from "../../../tests/form-conditions-suite";
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
} from "./form-conditions";

formConditionsSuite(it, {
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
