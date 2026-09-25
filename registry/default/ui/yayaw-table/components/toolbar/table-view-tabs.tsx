"use client";

import { Ellipsis, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TableDisplayMode } from "../../types/display-types";
import { TableTooltip } from "../../utils/table-tooltip";
import { splitViewTabs } from "../../utils/view-tabs";
import { DISPLAY_MODE_ICONS } from "./table-display-mode-switcher";

export interface ViewTabItem {
  /** `null` for the table's default view. */
  id: string | null;
  name: string;
  displayMode: TableDisplayMode;
}

interface TableViewTabsProps {
  activeId: string | null;
  canCreate: boolean;
  defaultTab: ViewTabItem;
  dirty: boolean;
  disabled: boolean;
  /** `more` names the "…" button of the views past `maxVisible`. */
  labels: { tabs: string; more: string; newView: string; modified: string };
  maxVisible: number;
  onCreate: () => void;
  onSelect: (id: string | null) => void;
  views: ViewTabItem[];
}

function ViewTab({
  active,
  dirty,
  disabled,
  modifiedLabel,
  onSelect,
  tab,
}: {
  active: boolean;
  dirty: boolean;
  disabled: boolean;
  modifiedLabel: string;
  onSelect: () => void;
  tab: ViewTabItem;
}) {
  const Icon = DISPLAY_MODE_ICONS[tab.displayMode];
  return (
    <Button
      aria-selected={active}
      className={cn(
        "h-8 min-w-0 max-w-48 shrink-0 gap-1.5 px-2.5 font-normal",
        !active && "text-muted-foreground"
      )}
      data-view-tab={tab.id ?? ""}
      disabled={disabled}
      onClick={onSelect}
      role="tab"
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{tab.name}</span>
      {active && dirty ? (
        <output
          aria-label={modifiedLabel}
          className="size-2 shrink-0 rounded-full bg-blue-500"
        />
      ) : null}
    </Button>
  );
}

/** Saved views as tabs, with the default view first and the rest under "…" (More views). */
export function TableViewTabs({
  activeId,
  canCreate,
  defaultTab,
  dirty,
  disabled,
  labels,
  maxVisible,
  onCreate,
  onSelect,
  views,
}: TableViewTabsProps) {
  const { visible, overflow } = splitViewTabs(
    views.map((view) => ({ ...view, id: view.id ?? "" })),
    activeId,
    maxVisible
  );
  return (
    <div className="flex min-w-0 items-center gap-1" data-view-tabs>
      <div
        aria-label={labels.tabs}
        className="flex min-w-0 items-center gap-1 overflow-hidden"
        role="tablist"
      >
        {[defaultTab, ...visible].map((tab) => (
          <ViewTab
            active={(tab.id || null) === activeId}
            dirty={dirty}
            disabled={disabled}
            key={tab.id ?? ""}
            modifiedLabel={labels.modified}
            onSelect={() => onSelect(tab.id || null)}
            tab={tab}
          />
        ))}
      </div>
      {overflow.length > 0 ? (
        <DropdownMenu>
          {/* An icon: the chevron next to it opens the view menu. */}
          <DropdownMenuTrigger
            render={
              <TableTooltip label={labels.more}>
                <Button
                  aria-label={labels.more}
                  className="size-8 shrink-0 text-muted-foreground"
                  disabled={disabled}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Ellipsis aria-hidden="true" className="size-4" />
                </Button>
              </TableTooltip>
            }
          />
          <DropdownMenuContent
            align="start"
            className="w-auto min-w-44 max-w-72"
          >
            {overflow.map((view) => {
              const Icon = DISPLAY_MODE_ICONS[view.displayMode];
              return (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => onSelect(view.id)}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canCreate ? (
        <Button
          aria-label={labels.newView}
          className="size-8 shrink-0 text-muted-foreground"
          disabled={disabled}
          onClick={onCreate}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
