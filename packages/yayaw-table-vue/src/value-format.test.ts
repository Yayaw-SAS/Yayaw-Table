import { it } from "vitest";
import { valueFormatSuite } from "../../../tests/value-format-suite";
import {
  formatDateValue,
  formatNumberValue,
  numberBarRatio,
} from "./value-format";

valueFormatSuite(it, { formatDateValue, formatNumberValue, numberBarRatio });
