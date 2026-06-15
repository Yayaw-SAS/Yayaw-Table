"use client";

import { Columns3, Images, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";

interface TableDisplayModeSwitcherProps {
  className?: string;
  defaultDisplayMode?: TableDisplayMode;
  displayModes?: TableDisplayMode[];
  tableId: string;
}

const DISPLAY_MODE_ICONS = {
  gallery: Images,
  kanban: Columns3,
  table: Table2,
} as const;

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
  const uniqueModes = displayModes.filter(
    (mode, index, modes) => modes.indexOf(mode) === index
  );

  if (uniqueModes.length <= 1) {
    return null;
  }

  return (
    <fieldset
      className={cn(
        "inline-flex h-8 rounded-md border bg-background p-0.5",
        className
      )}
    >
      <legend className="sr-only">{t("views.display.title")}</legend>
      {uniqueModes.map((mode) => {
        const Icon = DISPLAY_MODE_ICONS[mode];
        const isActive = displayModeParam === mode;
        const label = t(`views.display.${mode}`);

        return (
          <Button
            aria-pressed={isActive}
            className={cn(
              "h-7 gap-1.5 rounded-sm border-0 px-2 text-xs",
              !isActive && "text-muted-foreground"
            )}
            key={mode}
            onClick={() => {
              setDisplayModeFromUI(mode);
            }}
            size="sm"
            title={label}
            type="button"
            variant={isActive ? "secondary" : "ghost"}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </Button>
        );
      })}
    </fieldset>
  );
}
