"use client";

import { type CSSProperties, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { DashboardGrid } from "./dashboard-grid";
import { DASHBOARD_MARGIN, type DashboardLayoutItem } from "./dashboard-layout";
import type { DashboardSection } from "./dashboard-schema";

/** Where a widget renders: a stacked grid on phones, a flow at full width. */
export interface DashboardItemPlacement {
  phone: boolean;
  flow: boolean;
  /** Under a section title (widget titles are one level lower). */
  titled: boolean;
}

export interface DashboardSectionViewProps {
  section: DashboardSection;
  /** The section's title in the dashboard's language; empty shows none. */
  title: string;
  editing: boolean;
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  renderItem: (
    widgetId: string,
    placement: DashboardItemPlacement
  ) => ReactNode;
  /** Edit mode: the section's bar (its title input and menu), shown instead of its heading. */
  editBar?: ReactNode;
  /** Edit mode: what an empty section shows ("Add widget here"). */
  empty?: ReactNode;
}

const flowVariables = {
  "--dashboard-margin": `${DASHBOARD_MARGIN}px`,
} as CSSProperties;

const sectionIsEmpty = (section: DashboardSection): boolean =>
  section.type === "grid"
    ? section.layout.length === 0
    : section.widgetIds.length === 0;

/**
 * A section: its title (in edit mode, its bar), then a grid of cards (its own
 * gridstack) or widgets stacked at full width and their natural height (a
 * flow).
 */
export function DashboardSectionView({
  editBar,
  editing,
  empty,
  onLayoutChange,
  renderItem,
  section,
  title,
}: DashboardSectionViewProps) {
  const titleId = useId();
  const titled = Boolean(title);
  const bar = editing ? editBar : undefined;
  let body: ReactNode;
  if (editing && empty && sectionIsEmpty(section)) {
    body = empty;
  } else if (section.type === "grid") {
    body = (
      <DashboardGrid
        editing={editing}
        layout={section.layout}
        onLayoutChange={onLayoutChange}
        renderItem={(widgetId, phone) =>
          renderItem(widgetId, { phone, flow: false, titled })
        }
      />
    );
  } else {
    body = (
      <div
        className="yayaw-dashboard-flow"
        data-dashboard-flow=""
        style={flowVariables}
      >
        {section.widgetIds.map((widgetId) => (
          <div data-dashboard-item={widgetId} key={widgetId}>
            {renderItem(widgetId, { phone: false, flow: true, titled })}
          </div>
        ))}
      </div>
    );
  }
  return (
    <section
      aria-labelledby={titled ? titleId : undefined}
      className="flex min-w-0 flex-col gap-2"
      data-dashboard-section={section.id}
      data-section-type={section.type}
    >
      {titled ? (
        <h3
          className={cn("font-semibold text-base", bar ? "sr-only" : undefined)}
          data-section-title=""
          id={titleId}
        >
          {title}
        </h3>
      ) : null}
      {bar}
      {body}
    </section>
  );
}
