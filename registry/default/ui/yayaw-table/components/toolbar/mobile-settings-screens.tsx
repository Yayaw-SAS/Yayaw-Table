"use client";

import { useAtom } from "jotai";
import { Rows3 } from "lucide-react";
import { tableDensityAtom } from "../../atoms/table-atoms";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import {
  resolveDisplayMode,
  resolveDisplayModes,
} from "../../utils/display-modes";
import {
  TABLE_DENSITY_OPTIONS,
  type TableDensity,
} from "../../utils/table-contracts";
import { getViewModeCapabilities } from "../../utils/view-menu";
import { MenuChoiceList } from "./menu-choice-list";
import {
  DISPLAY_MODE_ICONS,
  TableDisplayModeSwitcher,
} from "./table-display-mode-switcher";
import type { SettingsScreen } from "./table-menu";

/**
 * Settings rows that open a screen of their own: the layout on every screen
 * size (as Notion's "Layout" row opens its tiles) and, in touch drawers, the
 * density, so the settings read as one list.
 */
export function useMobileSettingsScreens({
  enabled,
  defaultDensity = "medium",
  defaultDisplayMode,
  displayModes,
  tableId,
}: {
  enabled: boolean;
  defaultDensity?: TableDensity;
  defaultDisplayMode?: TableDisplayMode;
  displayModes?: TableDisplayMode[];
  tableId: string;
}): SettingsScreen[] | undefined {
  const { t } = useTranslations();
  const { displayModeParam } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const [override, setDensity] = useAtom(tableDensityAtom(tableId));
  const modes = resolveDisplayModes(displayModes ?? ["table"]);
  const activeMode = resolveDisplayMode({
    allowed: modes,
    fallback: defaultDisplayMode,
    requested: displayModeParam,
  });
  const density = override ?? defaultDensity;
  const ActiveIcon = DISPLAY_MODE_ICONS[activeMode];
  const screens: SettingsScreen[] = [];
  if (modes.length > 1) {
    const label = t("views.display.title");
    screens.push({
      id: "layout",
      label,
      icon: <ActiveIcon className="size-4" />,
      value: t(`views.display.${activeMode}`),
      content: (
        <TableDisplayModeSwitcher
          className="p-2"
          defaultDisplayMode={defaultDisplayMode}
          displayModes={modes}
          tableId={tableId}
        />
      ),
    });
  }
  if (enabled && getViewModeCapabilities(activeMode).density) {
    const translated = t("menu.density");
    const label = translated === "menu.density" ? "Table density" : translated;
    screens.push({
      id: "density",
      label,
      icon: <Rows3 className="size-4" />,
      value:
        TABLE_DENSITY_OPTIONS.find((option) => option.value === density)
          ?.label ?? "",
      content: (
        <MenuChoiceList
          label={label}
          onChange={setDensity}
          options={TABLE_DENSITY_OPTIONS}
          value={density}
        />
      ),
    });
  }
  return screens.length ? screens : undefined;
}
