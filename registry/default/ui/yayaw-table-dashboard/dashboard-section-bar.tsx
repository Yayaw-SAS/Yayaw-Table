"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DashboardSectionMove } from "./dashboard-editor-model";
import type { DashboardSection } from "./dashboard-schema";
import type { DashboardLabel } from "./dashboard-widget";

export interface DashboardSectionBarProps {
  section: DashboardSection;
  /** The section's name in menus: its title, else "Section 2". */
  name: string;
  /** The title in the language edited (no other language's version). */
  titleInput: string;
  label: DashboardLabel;
  canMove: (direction: DashboardSectionMove) => boolean;
  onRename: (title: string) => void;
  onMove: (direction: DashboardSectionMove) => void;
  onAddWidget: () => void;
  onRemove: () => void;
}

/** A section in edit mode: its title and its menu (move, add a widget, remove). */
export function DashboardSectionBar({
  canMove,
  label,
  name,
  onAddWidget,
  onMove,
  onRemove,
  onRename,
  section,
  titleInput,
}: DashboardSectionBarProps) {
  return (
    <div
      className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed px-2 py-1"
      data-section-bar={section.id}
    >
      <Input
        aria-label={label("sectionTitle")}
        className="h-8 max-w-80 flex-1 font-semibold"
        maxLength={120}
        onChange={(event) => onRename(event.target.value)}
        placeholder={name}
        value={titleInput}
      />
      <span className="shrink-0 text-muted-foreground text-xs">
        {label(section.type === "grid" ? "sectionGrid" : "sectionFlow")}
      </span>
      <span className="ms-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={label("sectionMenu", { title: name })}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem
              disabled={!canMove("up")}
              onClick={() => onMove("up")}
            >
              <ArrowUp aria-hidden="true" />
              {label("moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMove("down")}
              onClick={() => onMove("down")}
            >
              <ArrowDown aria-hidden="true" />
              {label("moveDown")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddWidget}>
              <Plus aria-hidden="true" />
              {label("addWidgetHere")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} variant="destructive">
              <Trash2 aria-hidden="true" />
              {label("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}

/** An empty section in edit mode: a dashed placeholder offering to add a widget. */
export function DashboardEmptySection({
  label,
  onAddWidget,
}: {
  label: DashboardLabel;
  onAddWidget: () => void;
}) {
  return (
    <div
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm"
      data-section-empty=""
    >
      <p className="m-0">{label("emptySection")}</p>
      <Button onClick={onAddWidget} size="sm" type="button" variant="outline">
        <Plus aria-hidden="true" />
        {label("addWidgetHere")}
      </Button>
    </div>
  );
}
