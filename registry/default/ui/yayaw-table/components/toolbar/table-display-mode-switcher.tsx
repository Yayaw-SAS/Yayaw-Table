"use client";

import {
  ChartGantt,
  Columns3,
  Images,
  type LucideIcon,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import {
  resolveDisplayMode,
  resolveDisplayModes,
} from "../../utils/display-modes";

interface TableDisplayModeSwitcherProps {
  className?: string;
  defaultDisplayMode?: TableDisplayMode;
  displayModes?: TableDisplayMode[];
  tableId: string;
}

const DISPLAY_MODE_ICONS: Record<TableDisplayMode, LucideIcon> = {
  gantt: ChartGantt,
  gallery: Images,
  kanban: Columns3,
  table: Table2,
};

export function TableDisplayModeSwitcher({
  className,
  defaultDisplayMode,
  displayModes = ["table"],
  tableId,
}: TableDisplayModeSwitcherProps) {
  const { t } = useTranslations();
  const { displayModeParam, setDisplayModeFromUI } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const uniqueModes = resolveDisplayModes(displayModes);
  // A link may request a mode this table does not offer; show the mode actually rendered.
  const activeMode = resolveDisplayMode({
    allowed: uniqueModes,
    fallback: defaultDisplayMode,
    requested: displayModeParam,
  });

  if (uniqueModes.length <= 1) {
    return null;
  }

  return (
    <fieldset className={cn("flex flex-wrap items-center gap-1", className)}>
      <legend className="mb-1 text-muted-foreground text-sm">
        {t("views.display.title")}
      </legend>
      {uniqueModes.map((mode) => {
        const Icon = DISPLAY_MODE_ICONS[mode];
        const isActive = activeMode === mode;
        const label = t(`views.display.${mode}`);

        return (
          <Button
            aria-pressed={isActive}
            className="min-w-9 flex-1 gap-1.5 px-2 font-normal"
            key={mode}
            onClick={() => setDisplayModeFromUI(mode)}
            size="sm"
            type="button"
            variant={isActive ? "secondary" : "ghost"}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
          </Button>
        );
      })}
    </fieldset>
  );
}
