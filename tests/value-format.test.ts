import { test } from "bun:test";
import {
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
} from "../src/components/ui/yayaw-table/utils/value-format";
import { valueFormatSuite } from "./value-format-suite";

valueFormatSuite(test, {
  formatDateValue,
  formatNumberValue,
  isBlankCardValue,
  numberBarRatio,
});
