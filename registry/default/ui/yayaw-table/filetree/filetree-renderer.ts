import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../types/display-mode-renderer";
import { FileTreeSettings } from "./filetree-settings";
import { FileTreeView } from "./filetree-view";

/** The built-in File tree mode: folders and files linked by a parent column. */
export const fileTreeRenderer: DisplayModeRenderer = {
  View: FileTreeView,
  Settings: FileTreeSettings,
};

/**
 * Renderers with the built-in File tree plugged in when the table has a parent
 * column (configured in `table.filetree` or detected); a host renderer for
 * `filetree` wins, and `table.filetree: false` withholds it.
 */
export function withFileTreeRenderer(
  renderers: DisplayModeRenderers | undefined,
  enabled: boolean
): DisplayModeRenderers | undefined {
  if (!enabled) {
    if (!renderers?.filetree) {
      return renderers;
    }
    const rest = { ...renderers };
    Reflect.deleteProperty(rest, "filetree");
    return rest;
  }
  return renderers?.filetree
    ? renderers
    : { ...renderers, filetree: fileTreeRenderer };
}
