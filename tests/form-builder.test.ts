import { test } from "bun:test";
import {
  FORM_BUILDER_FORM,
  FormBuilderController,
  formBuilderColumnKey,
  formBuilderItemKey,
  formBuilderKeyMove,
  formBuilderSummary,
  formBuilderSummaryLines,
  sameFormSettings,
} from "../src/components/ui/yayaw-table/utils/form-builder";
import {
  formColumns,
  formCreateFields,
  moveFormItemTo,
  normalizeFormViewConfig,
  resolveFormSettings,
  toggleFormQuestion,
  withFormFields,
} from "../src/components/ui/yayaw-table/utils/form-view";
import { formBuilderSuite } from "./form-builder-suite";

formBuilderSuite(
  test,
  {
    FORM_BUILDER_FORM,
    FormBuilderController,
    formBuilderColumnKey,
    formBuilderItemKey,
    formBuilderKeyMove,
    formBuilderSummary,
    formBuilderSummaryLines,
    sameFormSettings,
  },
  {
    formColumns,
    formCreateFields,
    moveFormItemTo,
    normalizeFormViewConfig,
    resolveFormSettings,
    toggleFormQuestion,
    withFormFields,
  }
);
