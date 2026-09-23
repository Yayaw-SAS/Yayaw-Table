import { it } from "vitest";
import { exportModelSuite } from "../../../tests/export-model-suite";
import {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportMatrix,
  printableHtml,
  runExport,
} from "./export-model";

exportModelSuite(it, {
  availableExportFormats,
  csvFromMatrix,
  defaultExportFileName,
  exportFileName,
  exportMatrix,
  printableHtml,
  runExport,
});
