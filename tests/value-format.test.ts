import { test } from "bun:test";
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
} from "../src/components/ui/yayaw-table/utils/value-format";
import { valueFormatSuite } from "./value-format-suite";

valueFormatSuite(test, {
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
