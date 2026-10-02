import { test } from "bun:test";
import {
  crc32,
  writeXlsx,
  XLSX_MIME_TYPE,
  xlsxBytes,
  xlsxColumnName,
  xlsxSheetName,
} from "../src/components/ui/yayaw-table-excel/xlsx-writer";
import { xlsxWriterSuite } from "./xlsx-writer-suite";

xlsxWriterSuite(test, {
  crc32,
  writeXlsx,
  XLSX_MIME_TYPE,
  xlsxBytes,
  xlsxColumnName,
  xlsxSheetName,
});
