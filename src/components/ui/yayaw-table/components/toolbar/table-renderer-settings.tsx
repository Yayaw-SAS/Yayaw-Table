"use client";

import { useMemo } from "react";
import { StackMenuContent } from "@/components/ui/custom/stack-menu";
import type { TableCatalogueColumnConfig } from "../../hooks/use-table-config";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type {
  DisplayModeRenderer,
  DisplayModeSettingsContext,
} from "../../types/display-mode-renderer";
import type { TableDisplayMode } from "../../types/display-types";
import {
  GENERIC_MODE_CONFIG_KEYS,
  type GenericModeConfigKey,
} from "../../utils/display-modes";
import { translateWithFallback } from "../filters/i18n-utils";

interface TableRendererSettingsProps {
  columns: TableCatalogueColumnConfig[];
  defaultDisplayMode?: TableDisplayMode;
  defaults?: Record<string, unknown>;
  mode: TableDisplayMode;
  renderer: DisplayModeRenderer;
  tableId: string;
}

const EMPTY_SETTINGS: Record<string, unknown> = {};

/** Settings of a mode rendered by an optional registry item, saved like built-in modes. */
export function TableRendererSettings({
  columns,
  defaultDisplayMode,
  defaults,
  mode,
  renderer,
  tableId,
}: TableRendererSettingsProps) {
  const { t, locale } = useTranslations();
  const { displayModeParam, modeConfigs, setModeConfigFromUI } =
    useTableUrlState({ defaultDisplayMode, tableId });
  const configKey = GENERIC_MODE_CONFIG_KEYS.find(
    (key: GenericModeConfigKey) => key === mode
  );
  const settings =
    (configKey &&
      (modeConfigs[configKey] as Record<string, unknown> | undefined)) ||
    EMPTY_SETTINGS;
  const context = useMemo<DisplayModeSettingsContext>(
    () => ({
      tableId,
      locale,
      columns,
      defaults: defaults ?? EMPTY_SETTINGS,
      settings,
      updateSettings: (next) => {
        if (configKey) {
          setModeConfigFromUI(configKey, next);
        }
      },
      translate: (key, fallback) => translateWithFallback(t, key, fallback),
    }),
    [
      columns,
      configKey,
      defaults,
      locale,
      setModeConfigFromUI,
      settings,
      t,
      tableId,
    ]
  );
  const { Settings } = renderer;
  if (displayModeParam !== mode || !Settings) {
    return null;
  }
  return (
    <StackMenuContent className="p-3">
      <Settings context={context} />
    </StackMenuContent>
  );
}
