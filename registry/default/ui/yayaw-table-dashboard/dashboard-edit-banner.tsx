"use client";

import {
  Check,
  History,
  LayoutGrid,
  Plus,
  Rows3,
  Send,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DashboardSectionType } from "./dashboard-schema";
import type { DashboardLabel } from "./dashboard-widget";

/** "Add section": a grid of cards or a full-width flow, at the end. */
function AddSectionMenu({
  disabled,
  label,
  onAdd,
}: {
  disabled: boolean;
  label: DashboardLabel;
  onAdd: (type: DashboardSectionType) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            data-add-section=""
            disabled={disabled}
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <Plus aria-hidden="true" />
        {label("addSection")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onAdd("grid")}>
          <LayoutGrid aria-hidden="true" />
          {label("sectionGrid")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("flow")}>
          <Rows3 aria-hidden="true" />
          {label("sectionFlow")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface DashboardEditBannerProps {
  label: DashboardLabel;
  canAddSection: boolean;
  /** "Done" (or "Save draft" beside "Publish") is saving. */
  saving: boolean;
  /** "Publish" is running. */
  publishing: boolean;
  onAddWidget: () => void;
  onAddSection: (type: DashboardSectionType) => void;
  /** Validates and saves; without a publish handler it ends the editing. */
  onDone: () => void;
  /** The host's version history; no button without it. */
  onHistory?: () => void;
  /** The host's "back to the default screen"; no button without it. */
  onResetToDefault?: () => void;
  /** Saves, then lets the host publish; no button without it. */
  onPublish?: () => void;
}

/**
 * Edit mode's banner: the screen's state ("Draft", what editing changes) and
 * every action on the document in one place: add a widget or a section, the
 * host's history and default screen when it has them, save and publish.
 */
export function DashboardEditBanner({
  canAddSection,
  label,
  onAddSection,
  onAddWidget,
  onDone,
  onHistory,
  onPublish,
  onResetToDefault,
  publishing,
  saving,
}: DashboardEditBannerProps) {
  const busy = saving || publishing;
  const doneLabel = onPublish ? label("saveDraft") : label("done");
  return (
    <section
      aria-label={label("draft")}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 px-3 py-2"
      data-dashboard-edit-banner=""
    >
      <span
        className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground text-xs"
        data-dashboard-draft=""
      >
        {label("draft")}
      </span>
      <p className="m-0 min-w-0 flex-1 basis-64 text-muted-foreground text-sm">
        {label(onPublish ? "editNoticePublish" : "editNotice")}
      </p>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button
          data-add-widget=""
          onClick={onAddWidget}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          {label("addWidget")}
        </Button>
        <AddSectionMenu
          disabled={!canAddSection}
          label={label}
          onAdd={onAddSection}
        />
        {onHistory ? (
          <Button
            data-dashboard-history=""
            onClick={onHistory}
            size="sm"
            type="button"
            variant="ghost"
          >
            <History aria-hidden="true" />
            {label("history")}
          </Button>
        ) : null}
        {onResetToDefault ? (
          <Button
            data-dashboard-reset=""
            disabled={busy}
            onClick={onResetToDefault}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Undo2 aria-hidden="true" />
            {label("resetToDefault")}
          </Button>
        ) : null}
        <Button
          data-dashboard-done=""
          disabled={busy}
          onClick={onDone}
          size="sm"
          type="button"
          variant={onPublish ? "outline" : "default"}
        >
          <Check aria-hidden="true" />
          {saving ? label("saving") : doneLabel}
        </Button>
        {onPublish ? (
          <Button
            data-dashboard-publish=""
            disabled={busy}
            onClick={onPublish}
            size="sm"
            type="button"
          >
            <Send aria-hidden="true" />
            {publishing ? label("publishing") : label("publish")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
