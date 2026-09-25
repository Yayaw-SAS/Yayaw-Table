"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import type { ChartColumn } from "@/src/components/ui/yayaw-table/utils/chart-model";
import {
  type Dashboard,
  type DashboardKpiPlan,
  type DashboardKpiResult,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  dashboardDayValue,
  dashboardKpiDisplay,
  dashboardKpiPlan,
  dashboardViewParams,
  loadDashboardKpi,
  widgetViewConfig,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-widget";

type KpiState =
  | { status: "loading" }
  | { status: "ready"; result: DashboardKpiResult }
  | { status: "error"; message: string };

const TREND_ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

export interface KpiWidgetProps {
  dashboard: Pick<Dashboard, "filters">;
  widget: DashboardWidget;
  source: DashboardTableSource;
  view?: DashboardView;
  /** Changes with "Refresh all": the numbers load again. */
  revision: number;
  locale: string;
  label: DashboardLabel;
  translate: DashboardTranslate;
}

type KpiContentProps = Omit<KpiWidgetProps, "revision"> & {
  onRetry: () => void;
};

function KpiContent({
  dashboard,
  label,
  locale,
  onRetry,
  source,
  translate,
  view,
  widget,
}: KpiContentProps) {
  const columns = source.config.columns
    .definitions as unknown as readonly ChartColumn[];
  const [state, setState] = useState<KpiState>({ status: "loading" });
  // Periods end today; the plan changes (and loads again) with the day.
  const planKey = JSON.stringify(
    dashboardKpiPlan(dashboard, widget, dashboardDayValue(new Date()), columns)
  );
  const plan = useMemo(() => JSON.parse(planKey) as DashboardKpiPlan, [planKey]);
  // Inline settings, else the saved view's: its filters and search.
  const paramsKey = JSON.stringify(
    dashboardViewParams(widgetViewConfig(widget, view))
  );
  const { actions } = source;
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardKpi({
      plan,
      actions: actions as Parameters<typeof loadDashboardKpi>[0]["actions"],
      params: JSON.parse(paramsKey) as Record<string, unknown>,
      locale,
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", result });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => controller.abort();
  }, [actions, locale, paramsKey, plan]);

  if (state.status === "error") {
    return (
      <div data-kpi="">
        <p data-kpi-state="error" role="alert">
          {label("widgetError", { error: state.message })}
        </p>
        <Button
          className="self-start"
          onClick={onRetry}
          size="xs"
          type="button"
          variant="outline"
        >
          {label("retry")}
        </Button>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div aria-busy="true" data-kpi="">
        <output data-kpi-state="loading">{label("widgetLoading")}</output>
      </div>
    );
  }
  const display = dashboardKpiDisplay({
    plan,
    result: state.result,
    columns,
    locale,
    translate,
  });
  const comparison = display.comparison;
  const TrendIcon = comparison ? TREND_ICONS[comparison.trend] : undefined;
  return (
    <div data-kpi="">
      <div data-kpi-main="">
        <output data-chart-number="" data-kpi-value="" title={display.caption}>
          {display.value}
        </output>
        {display.trend ? (
          <svg
            data-kpi-trend=""
            preserveAspectRatio="none"
            role="img"
            viewBox="0 0 100 32"
          >
            <title>{display.trend.title}</title>
            <polyline points={display.trend.points} />
          </svg>
        ) : null}
      </div>
      {comparison && TrendIcon ? (
        <p
          data-kpi-compare=""
          data-tone={comparison.tone}
          data-trend={comparison.trend}
          title={comparison.periods}
        >
          <TrendIcon aria-hidden="true" />
          <span>{comparison.text}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A number over a table or a view's records, in the column's format, with
 * its change against the previous period and a trend line when the widget
 * asks for them. Aggregated by the host (`aggregate`), else over `list`.
 */
export function KpiWidget({ revision, ...props }: KpiWidgetProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <KpiContent
      {...props}
      key={`${revision}:${attempt}`}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
