import { it } from "vitest";
import { scopedRowsSuite } from "../../../tests/scoped-rows-suite";
import {
  loadScopedRows,
  localDayKey,
  rowInScope,
  ScopedRowsOverflowError,
} from "./scoped-rows";

scopedRowsSuite(it, {
  localDayKey,
  loadScopedRows,
  rowInScope,
  ScopedRowsOverflowError,
});
