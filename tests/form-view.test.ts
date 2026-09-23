import { test } from "bun:test";
import {
  normalizeModeConfig,
  pickGenericModeSettings,
  resolveDisplayModes,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import {
  acceptPublicFormResponse,
  formColumns,
  formDateAnswer,
  formDateDisplay,
  formDraftValues,
  formLabel,
  formNumberDisplay,
  formSettingsFromView,
  formSubmission,
  formSubmitResultFrom,
  formTranslateFrom,
  formWeekStart,
  initialFormDraft,
  isFormModeEnabled,
  moveFormQuestion,
  normalizeFormViewConfig,
  publicFormSnapshot,
  resolveFormSettings,
  toggleFormQuestion,
  updateFormQuestion,
  validateFormValues,
} from "../src/components/ui/yayaw-table/utils/form-view";
import { formViewSuite } from "./form-view-suite";

formViewSuite(
  test,
  {
    acceptPublicFormResponse,
    formColumns,
    formDateAnswer,
    formDateDisplay,
    formDraftValues,
    formLabel,
    formNumberDisplay,
    formSettingsFromView,
    formSubmission,
    formSubmitResultFrom,
    formTranslateFrom,
    initialFormDraft,
    isFormModeEnabled,
    moveFormQuestion,
    normalizeFormViewConfig,
    publicFormSnapshot,
    resolveFormSettings,
    toggleFormQuestion,
    updateFormQuestion,
    validateFormValues,
    formWeekStart,
  },
  { normalizeModeConfig, pickGenericModeSettings, resolveDisplayModes }
);
