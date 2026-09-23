import { test } from "bun:test";
import {
  loadScopedRows,
  localDayKey,
  rowInScope,
  ScopedRowsOverflowError,
} from "../src/components/ui/yayaw-table/utils/scoped-rows";
import { scopedRowsSuite } from "./scoped-rows-suite";

scopedRowsSuite(test, {
  localDayKey,
  loadScopedRows,
  rowInScope,
  ScopedRowsOverflowError,
});
