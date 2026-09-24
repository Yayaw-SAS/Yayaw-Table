import { it } from "vitest";
import { valueFormatSuite } from "../../../tests/value-format-suite";
import {
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
} from "./value-format";

valueFormatSuite(it, {
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
});
