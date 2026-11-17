import { lazyComponent } from "../components/lazy-component";
import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../types/display-mode-renderer";

/** The built-in Form mode: a create form in the view, and its settings panel. */
export const formRenderer: DisplayModeRenderer = {
  View: lazyComponent(async () => (await import("./form-view")).FormView),
  Settings: lazyComponent(
    async () => (await import("./form-settings")).FormSettings
  ),
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
