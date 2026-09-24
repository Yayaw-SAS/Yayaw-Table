"use client";

import { Button } from "@/components/ui/button";
import { ViewSettingsPanel } from "../components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import {
  type FileTreeColumn,
  type FileTreeViewSettings,
  fileTreeSettingFields,
} from "../utils/filetree-model";

/** View → Card settings of the file tree: columns, details pane, order and first load. */
export function FileTreeSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const view = context.settings as FileTreeViewSettings;
  const fields = fileTreeSettingFields({
    columns: context.columns as FileTreeColumn[],
    defaults: context.defaults as FileTreeViewSettings,
    view,
    locale: context.locale,
    translate: (key, fallback) =>
      context.translate(`filetree.${key}`, fallback),
    update: (next) =>
      context.updateSettings(next as Record<string, unknown> | undefined),
  });
  return (
    <ViewSettingsPanel fields={fields}>
      <Button
        className="font-normal"
        disabled={Object.keys(view).length === 0}
        onClick={() => context.updateSettings(undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        {context.translate("common.reset", "Reset")}
      </Button>
    </ViewSettingsPanel>
  );
}
