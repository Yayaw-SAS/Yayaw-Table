import { it } from "vitest";
import { exportModelSuite } from "../../../tests/export-model-suite";
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
} from "./export-model";

exportModelSuite(it, {
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
