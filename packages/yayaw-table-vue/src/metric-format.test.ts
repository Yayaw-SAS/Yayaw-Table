import { it } from "vitest";
import { metricFormatSuite } from "../../../tests/metric-format-suite";
import { metricValueFormatter, normalizeMetricFormat } from "./metric-format";

metricFormatSuite(it, { metricValueFormatter, normalizeMetricFormat });
