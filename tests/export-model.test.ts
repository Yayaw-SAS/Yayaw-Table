import { test } from "bun:test";
import {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportMatrix,
  printableHtml,
  runExport,
} from "../src/components/ui/yayaw-table/utils/export-model";
import { exportModelSuite } from "./export-model-suite";

exportModelSuite(test, {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportMatrix,
  printableHtml,
  runExport,
});
