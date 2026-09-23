import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../types/display-mode-renderer";
import { FormSettings } from "./form-settings";
import { FormView } from "./form-view";

/** The built-in Form mode: a create form in the view, and its settings panel. */
export const formRenderer: DisplayModeRenderer = {
  View: FormView,
  Settings: FormSettings,
};

/**
 * Renderers with the built-in Form mode plugged in when the table can create
 * records (a host renderer for `form` wins), and withheld otherwise.
 */
export function withFormRenderer(
  renderers: DisplayModeRenderers | undefined,
  enabled: boolean
): DisplayModeRenderers | undefined {
  if (!enabled) {
    if (!renderers?.form) {
      return renderers;
    }
    const rest = { ...renderers };
    Reflect.deleteProperty(rest, "form");
    return rest;
  }
  return renderers?.form ? renderers : { form: formRenderer, ...renderers };
}
