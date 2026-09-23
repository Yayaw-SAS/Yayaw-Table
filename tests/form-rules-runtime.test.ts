import { test } from "bun:test";
import {
  bulkBlockedFields,
  bulkFieldEditable,
  bulkMixedFieldsOf,
  bulkRuleContext,
} from "../src/components/ui/yayaw-table/components/forms/bulk-form";
import {
  fieldIsHidden,
  fieldIsRequired,
  formSubmissionValues,
  validateForm,
  withFormRules,
} from "../src/components/ui/yayaw-table/components/forms/form-runtime";
import {
  type FormRulesRuntime,
  formRulesRuntimeSuite,
} from "./form-rules-runtime-suite";

formRulesRuntimeSuite(test, {
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
