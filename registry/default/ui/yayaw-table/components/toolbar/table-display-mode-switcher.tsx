"use client";

import {
  CalendarDays,
  ChartColumnBig,
  ChartGantt,
  ClipboardList,
  Columns3,
  FolderTree,
  Images,
  List,
  type LucideIcon,
  MapIcon,
  Newspaper,
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

export const DISPLAY_MODE_ICONS: Record<TableDisplayMode, LucideIcon> = {
  calendar: CalendarDays,
  chart: ChartColumnBig,
  feed: Newspaper,
  filetree: FolderTree,
  form: ClipboardList,
  gantt: ChartGantt,
  gallery: Images,
  kanban: Columns3,
  list: List,
  map: MapIcon,
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
    // Layout tiles as Notion offers them: icon over name, three per row, the current one marked.
    <fieldset
      className={cn(
        "m-0 grid min-w-0 grid-cols-3 gap-1.5 border-0 p-0",
        className
      )}
    >
      <legend className="col-span-3 mb-1 text-muted-foreground text-xs">
        {t("views.display.title")}
      </legend>
      {uniqueModes.map((mode) => {
        const Icon = DISPLAY_MODE_ICONS[mode];
        const isActive = activeMode === mode;
        const label = t(`views.display.${mode}`);

        return (
          <Button
            aria-pressed={isActive}
            className={cn(
              "h-16 min-w-0 flex-col gap-1.5 px-1 font-normal text-xs",
              isActive && "font-semibold ring-1 ring-primary"
            )}
            data-layout={mode}
            key={mode}
            onClick={() => setDisplayModeFromUI(mode)}
            type="button"
            variant="outline"
          >
            <Icon aria-hidden="true" className="size-5" />
            <span className="max-w-full truncate">{label}</span>
          </Button>
        );
      })}
    </fieldset>
  );
}
