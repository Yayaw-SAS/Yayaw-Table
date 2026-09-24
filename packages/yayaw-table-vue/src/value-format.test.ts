import { it } from "vitest";
import { valueFormatSuite } from "../../../tests/value-format-suite";
import {
  datePartOfPattern,
  formatColumnDate,
  formatColumnDay,
  formatColumnNumber,
  formatColumnValue,
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
} from "./value-format";

valueFormatSuite(it, {
  datePartOfPattern,
  formatColumnDate,
  formatColumnDay,
  formatColumnNumber,
  formatColumnValue,
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
});
