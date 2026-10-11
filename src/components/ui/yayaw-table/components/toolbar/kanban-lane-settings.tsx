"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useId } from "react";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  type KanbanLaneSettings,
  moveKanbanLane,
  setKanbanLaneHidden,
} from "../../utils/kanban-lanes";

export interface KanbanLaneSettingsLabels {
  lanes: string;
  showLane: (lane: string) => string;
  moveLaneUp: (lane: string) => string;
  moveLaneDown: (lane: string) => string;
  resetLanes: string;
}

/**
 * Lane order and visibility of the grouping column: a checkbox shows or
 * hides each lane, and move buttons reorder them. At an end, a move stays
 * focusable but inactive, as the view order's moves do.
 */
export function KanbanLaneSettingsEditor({
  labels,
  lanes,
  onChange,
  onReset,
  resettable,
  settings,
}: {
  labels: KanbanLaneSettingsLabels;
  /** Every lane, in the current order, hidden ones included. */
  lanes: { value: string; label: string }[];
  onChange: (settings: KanbanLaneSettings) => void;
  onReset: () => void;
  /** The view changes the lanes: Reset lanes restores the default ones. */
  resettable: boolean;
  settings: KanbanLaneSettings;
}) {
  const id = useId();
  if (lanes.length === 0) {
    return null;
  }
  const values = lanes.map((lane) => lane.value);
  const hidden = new Set(settings.hidden ?? []);
  const move = (value: string, offset: number) =>
    onChange(moveKanbanLane(settings, values, value, offset));
  return (
    <fieldset
      className="grid min-w-0 gap-1 border-t pt-3"
      data-kanban-lane-settings=""
    >
      <legend className="mb-1 font-medium text-sm">{labels.lanes}</legend>
      <ul className="grid max-h-64 min-w-0 gap-0.5 overflow-y-auto">
        {lanes.map((lane, index) => {
          const controlId = `${id}-lane-${index}`;
          const first = index === 0;
          const last = index === lanes.length - 1;
          return (
            <li
              className="flex min-h-9 min-w-0 items-center gap-2 rounded-md px-1 text-sm hover:bg-accent max-md:min-h-11"
              data-kanban-lane-setting={lane.value}
              key={lane.value}
            >
              <Checkbox
                aria-label={labels.showLane(lane.label)}
                checked={!hidden.has(lane.value)}
                className="min-h-0! min-w-0!"
                id={controlId}
                onCheckedChange={(checked) =>
                  onChange(
                    setKanbanLaneHidden(settings, lane.value, !checked)
                  )
                }
              />
              <label
                className="min-w-0 flex-1 cursor-pointer truncate py-1"
                htmlFor={controlId}
              >
                {lane.label}
              </label>
              <Button
                aria-disabled={first || undefined}
                aria-label={labels.moveLaneUp(lane.label)}
                className="size-7 text-muted-foreground aria-disabled:opacity-40"
                onClick={() => {
                  if (!first) {
                    move(lane.value, -1);
                  }
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowUp aria-hidden="true" className="size-3.5" />
              </Button>
              <Button
                aria-disabled={last || undefined}
                aria-label={labels.moveLaneDown(lane.label)}
                className="size-7 text-muted-foreground aria-disabled:opacity-40"
                onClick={() => {
                  if (!last) {
                    move(lane.value, 1);
                  }
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowDown aria-hidden="true" className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        className="justify-start font-normal"
        disabled={!resettable}
        onClick={onReset}
        size="sm"
        type="button"
        variant="ghost"
      >
        {labels.resetLanes}
      </Button>
    </fieldset>
  );
}
