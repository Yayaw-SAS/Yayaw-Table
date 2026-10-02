import { it } from "vitest";
import { xlsxWriterSuite } from "../../../tests/xlsx-writer-suite";
import {
  crc32,
  writeXlsx,
  XLSX_MIME_TYPE,
  xlsxBytes,
  xlsxColumnName,
  xlsxSheetName,
} from "./excel/xlsx-writer";

xlsxWriterSuite(it, {
  crc32,
  writeXlsx,
  XLSX_MIME_TYPE,
  xlsxBytes,
  xlsxColumnName,
  xlsxSheetName,
});
