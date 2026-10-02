import { test } from "bun:test";
import {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportLabels,
  exportMatrix,
  exportRecordCount,
  isExportableColumn,
  printableHtml,
  runExport,
} from "../src/components/ui/yayaw-table/utils/export-model";
import { exportModelSuite } from "./export-model-suite";

exportModelSuite(test, {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportLabels,
  exportMatrix,
  exportRecordCount,
  isExportableColumn,
  printableHtml,
  runExport,
});
