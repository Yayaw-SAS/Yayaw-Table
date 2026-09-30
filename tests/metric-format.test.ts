import { test } from "bun:test";
import {
  metricValueFormatter,
  normalizeMetricFormat,
} from "../src/components/ui/yayaw-table/utils/metric-format";
import { metricFormatSuite } from "./metric-format-suite";

metricFormatSuite(test, { metricValueFormatter, normalizeMetricFormat });
