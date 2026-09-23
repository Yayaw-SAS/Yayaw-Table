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
  formDraftValues,
  formLabel,
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
} from "./form-view";

formViewSuite(
  it,
  {
    acceptPublicFormResponse,
    formColumns,
    formDraftValues,
    formLabel,
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
  },
  { normalizeModeConfig, pickGenericModeSettings, resolveDisplayModes }
);
