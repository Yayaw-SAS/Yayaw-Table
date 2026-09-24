import { it } from "vitest";
import { formBuilderSuite } from "../../../tests/form-builder-suite";
import {
  FORM_BUILDER_FORM,
  FormBuilderController,
  formBuilderColumnKey,
  formBuilderItemKey,
  formBuilderKeyMove,
  formBuilderSummary,
  formBuilderSummaryLines,
  sameFormSettings,
} from "./form-builder";
import {
  formColumns,
  formCreateFields,
  moveFormItemTo,
  normalizeFormViewConfig,
  resolveFormSettings,
  toggleFormQuestion,
  withFormFields,
} from "./form-view";

formBuilderSuite(
  it,
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
