import { test } from "bun:test";
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
} from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import { chartModelSuite } from "./chart-model-suite";

chartModelSuite(
  test,
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
