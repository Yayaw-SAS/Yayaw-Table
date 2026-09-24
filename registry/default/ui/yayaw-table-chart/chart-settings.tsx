"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "@/components/ui/yayaw-table/components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import {
  type ChartStageList,
  type ChartViewSettings,
  chartSettingFields,
  chartStageList,
} from "@/components/ui/yayaw-table/utils/chart-model";
import { cn } from "@/lib/utils";

/** A funnel's stages: drag one, or use its arrows, to change the order. */
function StageOrder({ list }: { list: ChartStageList }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<number>();
  const [target, setTarget] = useState<number>();
  const endDrag = () => {
    setDragged(undefined);
    setTarget(undefined);
  };
  // The moved stage keeps the focus, on the arrow that can still move it.
  const moveByKeyboard = (from: number, to: number, value: string) => {
    list.move(from, to);
    requestAnimationFrame(() => {
      const buttons = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>(
          `[data-stage-move="${CSS.escape(value)}"]`
        ) ?? []),
      ];
      const preferred = to < from ? buttons.at(0) : buttons.at(1);
      (preferred?.disabled
        ? buttons.find((button) => !button.disabled)
        : preferred
      )?.focus();
    });
  };
  return (
    <div className="grid gap-1.5" data-chart-stages ref={root}>
      <p className="text-muted-foreground text-sm" id={`${id}-label`}>
        {list.label}
      </p>
      <ol aria-labelledby={`${id}-label`} className="grid gap-1">
        {list.stages.map((stage, index) => (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: a stage is dragged and dropped with the pointer; its arrow buttons are the keyboard path.
          <li
            className={cn(
              "flex min-h-9 min-w-0 items-center gap-1 rounded-md border bg-background pr-1 pl-1.5 text-sm",
              target === index && dragged !== index && "border-primary",
              dragged === index && "opacity-50"
            )}
            data-stage={stage.value}
            draggable
            key={stage.value}
            onDragEnd={endDrag}
            onDragOver={(event) => {
              if (dragged !== undefined) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setTarget(index);
              }
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", stage.label);
              setDragged(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged !== undefined && dragged !== index) {
                list.move(dragged, index);
              }
              endDrag();
            }}
          >
            <GripVertical
              aria-hidden="true"
              className="size-4 shrink-0 cursor-grab text-muted-foreground/60"
            />
            <span className="min-w-0 flex-1 truncate">{stage.label}</span>
            <Button
              aria-label={stage.moveUpLabel}
              data-stage-move={stage.value}
              disabled={index === 0}
              onClick={() => moveByKeyboard(index, index - 1, stage.value)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              aria-label={stage.moveDownLabel}
              data-stage-move={stage.value}
              disabled={index === list.stages.length - 1}
              onClick={() => moveByKeyboard(index, index + 1, stage.value)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-xs">{list.hint}</p>
      {list.customized ? (
        <Button
          className="justify-self-start font-normal"
          onClick={list.reset}
          size="sm"
          type="button"
          variant="ghost"
        >
          {list.resetLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** View → Card settings of the chart: type, axes, grouping and display. */
export function ChartSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const view = context.settings as ChartViewSettings;
  const input = {
    columns: context.columns,
    defaults: context.defaults as ChartViewSettings,
    view,
    locale: context.locale,
    translate: (key: string, fallback: string) =>
      context.translate(`chart.${key}`, fallback),
    update: (next: Record<string, unknown>) => context.updateSettings(next),
  };
  const fields: ViewSettingField[] = chartSettingFields(input);
  const stages = chartStageList(input);
  return (
    <ViewSettingsPanel fields={fields}>
      {stages ? <StageOrder list={stages} /> : null}
      <Button
        className="font-normal"
        disabled={Object.keys(view).length === 0}
        onClick={() => context.updateSettings(undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        {context.translate("common.reset", "Reset")}
      </Button>
    </ViewSettingsPanel>
  );
}
