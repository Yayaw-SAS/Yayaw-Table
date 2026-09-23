import { it } from "vitest";
import {
  type FormRulesRuntime,
  formRulesRuntimeSuite,
} from "../../../tests/form-rules-runtime-suite";
import {
  bulkBlockedFields,
  bulkFieldEditable,
  bulkMixedFieldsOf,
  bulkRuleContext,
} from "./bulk-form";
import {
  fieldIsHidden,
  fieldIsRequired,
  formSubmissionValues,
  validateForm,
  withFormRules,
} from "./form-runtime";

formRulesRuntimeSuite(it, {
  bulkBlockedFields,
  bulkFieldEditable,
  bulkMixedFieldsOf,
  bulkRuleContext,
  fieldIsHidden,
  fieldIsRequired,
  formSubmissionValues,
  validateForm,
  withFormRules,
} as unknown as FormRulesRuntime);
