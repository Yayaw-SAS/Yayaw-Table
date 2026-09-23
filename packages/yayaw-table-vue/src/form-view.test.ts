import { it } from "vitest";
import { formViewSuite } from "../../../tests/form-view-suite";
import {
  normalizeModeConfig,
  pickGenericModeSettings,
  resolveDisplayModes,
} from "./display-modes";
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
} from "./form-view";

formViewSuite(
  it,
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
