"use client";

import {
  CalendarDays,
  ChartColumnBig,
  ChartGantt,
  ClipboardList,
  Columns3,
  Images,
  List,
  type LucideIcon,
  Table2,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "../../hooks/use-mobile";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import { useStackMenu } from "../../ui-custom/stack-menu";
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

export const DISPLAY_MODE_ICONS: Record<TableDisplayMode, LucideIcon> = {
  calendar: CalendarDays,
  chart: ChartColumnBig,
  form: ClipboardList,
  gantt: ChartGantt,
  gallery: Images,
  kanban: Columns3,
  list: List,
  table: Table2,
};

export function TableDisplayModeSwitcher({
  className,
  defaultDisplayMode,
  displayModes = ["table"],
  tableId,
}: TableDisplayModeSwitcherProps) {
  const { t } = useTranslations();
  const id = useId();
  const isMobile = useIsMobile();
  const { compact } = useStackMenu();
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

  // A menu scales with the number of modes; touch drawers keep the buttons.
  if (!(isMobile || compact)) {
    const options = uniqueModes.map((mode) => ({
      value: mode,
      label: t(`views.display.${mode}`),
    }));
    return (
      <div className={cn("grid min-w-0 gap-1.5", className)}>
        <label className="text-muted-foreground text-sm" htmlFor={id}>
          {t("views.display.title")}
        </label>
        <Select
          items={options}
          onValueChange={(value) => {
            if (value !== null) {
              setDisplayModeFromUI(value);
            }
          }}
          value={activeMode}
        >
          <SelectTrigger
            aria-label={t("views.display.title")}
            className="w-full min-w-0 font-normal"
            id={id}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {options.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    // Three columns keep every layout readable in a phone-width drawer.
    <fieldset className={cn("grid grid-cols-3 gap-1", className)}>
      <legend className="col-span-3 mb-1 text-muted-foreground text-sm">
        {t("views.display.title")}
      </legend>
      {uniqueModes.map((mode) => {
        const Icon = DISPLAY_MODE_ICONS[mode];
        const isActive = activeMode === mode;
        const label = t(`views.display.${mode}`);

        return (
          <Button
            aria-pressed={isActive}
            className="min-w-0 gap-1.5 px-2 font-normal"
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
