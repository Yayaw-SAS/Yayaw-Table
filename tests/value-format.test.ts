import { test } from "bun:test";
import {
  formatDateValue,
  formatNumberValue,
  numberBarRatio,
} from "../src/components/ui/yayaw-table/utils/value-format";
import { valueFormatSuite } from "./value-format-suite";

valueFormatSuite(test, { formatDateValue, formatNumberValue, numberBarRatio });
