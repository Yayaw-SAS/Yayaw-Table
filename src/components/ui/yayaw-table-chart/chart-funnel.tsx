"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  type ChartCategory,
  type ChartFunnelStage,
  type ChartFunnelText,
  type ChartLabelKey,
  type ChartModel,
  chartFunnelLayout,
} from "@/src/components/ui/yayaw-table/utils/chart-model";

type Label = (
  key: ChartLabelKey,
  params?: Record<string, number | string>
) => string;

const percentOf = (part: number, whole: number) =>
  `${whole ? (part / whole) * 100 : 0}%`;

/** The funnel's width: measured, and followed as the container resizes. */
function useWidth() {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const measure = () => setWidth(Math.round(element.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { container, width };
}

function FunnelText({
  className,
  text,
}: {
  className: string;
  text: ChartFunnelText;
}) {
  return (
    <text
      className={className}
      textAnchor={text.anchor}
      x={text.x}
      y={text.y}
    >
      {text.text}
    </text>
  );
}

/** "Active: 3, 100% of first" and so on, for assistive technology. */
const stageSummary = (stage: ChartFunnelStage) =>
  [stage.valueText, stage.shareText, stage.conversionText]
    .filter(Boolean)
    .join(", ");

/**
 * The funnel: SVG shapes from the shared geometry (the Vue edition draws the
 * same), with a button over each stage that shows its records.
 */
export function FunnelChart({
  model,
  clickable,
  onGroup,
  label,
}: {
  model: ChartModel;
  clickable: boolean;
  onGroup: (category?: ChartCategory) => void;
  label: Label;
}) {
  const id = useId();
  const { container, width } = useWidth();
  const [active, setActive] = useState<string>();
  const layout = chartFunnelLayout(model.stages ?? [], width);
  return (
    <div
      className="relative w-full"
      data-chart-funnel={layout.orientation}
      ref={container}
    >
      <svg
        aria-describedby={`${id}-desc`}
        aria-labelledby={`${id}-title`}
        className="block h-auto w-full overflow-visible"
        height={layout.height}
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
      >
        <title id={`${id}-title`}>{model.title}</title>
        <desc id={`${id}-desc`}>
          {layout.shapes
            .map((shape) => `${shape.stage.label}: ${stageSummary(shape.stage)}`)
            .join("; ")}
        </desc>
        {layout.shapes.map((shape) => (
          <g data-funnel-stage={shape.stage.label} key={shape.stage.id}>
            <polygon
              className={cn(
                "transition-opacity",
                active && active !== shape.stage.id && "opacity-50"
              )}
              fill={shape.stage.color}
              points={shape.points}
            />
            <FunnelText
              className="fill-foreground font-medium text-xs"
              text={shape.name}
            />
            <FunnelText
              className="fill-foreground font-semibold text-xs tabular-nums"
              text={shape.value}
            />
            <FunnelText
              className="fill-muted-foreground text-[11px] tabular-nums"
              text={shape.share}
            />
            {shape.conversion ? (
              <FunnelText
                className="fill-muted-foreground text-[11px] tabular-nums"
                text={shape.conversion}
              />
            ) : null}
          </g>
        ))}
      </svg>
      {clickable
        ? layout.shapes
            .filter((shape) => !shape.stage.category.other)
            .map((shape) => (
              <button
                aria-label={label("showRecords", { group: shape.stage.label })}
                className="absolute cursor-pointer rounded-md outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
                data-funnel-button
                key={shape.stage.id}
                onBlur={() => setActive(undefined)}
                onClick={() => onGroup(shape.stage.category)}
                onFocus={() => setActive(shape.stage.id)}
                onMouseEnter={() => setActive(shape.stage.id)}
                onMouseLeave={() => setActive(undefined)}
                style={{
                  left: percentOf(shape.box.x, layout.width),
                  top: percentOf(shape.box.y, layout.height),
                  width: percentOf(shape.box.width, layout.width),
                  height: percentOf(shape.box.height, layout.height),
                }}
                type="button"
              />
            ))
        : null}
    </div>
  );
}

/** The funnel's numbers as a table: stage, value, share of the first stage and conversion. */
export function FunnelDataTable({
  model,
  clickable,
  onGroup,
  label,
}: {
  model: ChartModel;
  clickable: boolean;
  onGroup: (category?: ChartCategory) => void;
  label: Label;
}) {
  const percent = (share: number | undefined) =>
    share === undefined ? "—" : model.formatShare(share);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" data-chart-table>
        <caption className="sr-only">{model.title}</caption>
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              {label("stage")}
            </th>
            <th className="px-3 py-2 text-right font-medium" scope="col">
              {model.valueLabel}
            </th>
            <th className="px-3 py-2 text-right font-medium" scope="col">
              {label("shareOfFirst")}
            </th>
            <th className="px-3 py-2 text-right font-medium" scope="col">
              {label("conversion")}
            </th>
          </tr>
        </thead>
        <tbody>
          {(model.stages ?? []).map((stage) => (
            <tr className="border-t" key={stage.id}>
              <th className="px-3 py-1.5 text-left font-normal" scope="row">
                {clickable ? (
                  <Button
                    aria-label={label("showRecords", { group: stage.label })}
                    className="h-auto px-0 py-0 font-normal"
                    onClick={() => onGroup(stage.category)}
                    type="button"
                    variant="link"
                  >
                    {stage.label}
                  </Button>
                ) : (
                  stage.label
                )}
              </th>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {stage.valueText}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {percent(stage.shareOfFirst)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {percent(stage.conversion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
