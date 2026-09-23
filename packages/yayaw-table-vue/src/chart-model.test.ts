import { it } from "vitest";
import { chartModelSuite } from "../../../tests/chart-model-suite";
import {
  aggregateChartRows,
  buildChartModel,
  canAddChartFilters,
  chartAggregateParams,
  chartAggregateRequest,
  chartBucketKey,
  chartBucketLabel,
  chartBucketRange,
  chartGroupFilters,
  chartLabel,
  chartSettingFields,
  chartValueTicks,
  loadChartData,
  nextChartBucketKey,
  normalizeChartAggregateResult,
  normalizeChartViewConfig,
  resolveChartSettings,
  withChartFilters,
} from "./chart-model";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "./display-modes";

chartModelSuite(
  it,
  {
    aggregateChartRows,
    buildChartModel,
    canAddChartFilters,
    chartAggregateParams,
    chartAggregateRequest,
    chartBucketKey,
    chartBucketLabel,
    chartBucketRange,
    chartGroupFilters,
    chartLabel,
    chartSettingFields,
    chartValueTicks,
    loadChartData,
    nextChartBucketKey,
    normalizeChartAggregateResult,
    normalizeChartViewConfig,
    resolveChartSettings,
    withChartFilters,
  },
  {
    modeDefaultsOf,
    normalizeModeConfig,
    resolveDisplayModes,
    withoutDisabledModeRenderers,
  }
);
