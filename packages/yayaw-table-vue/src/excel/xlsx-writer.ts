/**
 * The optional Excel item: writes an .xlsx file in the browser from the
 * table's export matrix (the same headers and cells as the CSV), so the Export
 * screen offers Excel without `actions.exportFile`. Framework-agnostic and
 * dependency-free: a minimal SpreadsheetML workbook (one worksheet named after
 * the table, a bold header row, numbers as numeric cells, other values as
 * inline strings) in a store-only ZIP. Shared as-is by the React and Vue items.
 */

/** The export matrix (`ExportMatrix` in `export-model.ts`). */
export interface XlsxMatrix {
  headers: readonly string[];
  rows: readonly (readonly (string | number | boolean | null)[])[];
}

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SHEET_NAME_FORBIDDEN = /[\\/?*[\]:\s]+/g;
const EDGE_APOSTROPHES = /^'+|'+$/g;
const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const XML_UNSAFE = /[&<>"]/g;
const MAX_SHEET_NAME = 31;
const MAX_COLUMN_WIDTH = 60;
const MIN_COLUMN_WIDTH = 8;

/** Excel's rules: 1 to 31 characters, none of \ / ? * [ ] :, no edge apostrophe. */
export function xlsxSheetName(name: string): string {
  const clean = name
    .replace(SHEET_NAME_FORBIDDEN, " ")
    .replace(EDGE_APOSTROPHES, "")
    .trim()
    .slice(0, MAX_SHEET_NAME)
    .trim();
  return clean || "Sheet1";
}

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const FIRST_PRINTABLE = 0x20;
const SURROGATES = [0xd8_00, 0xdf_ff] as const;
const NON_CHARACTERS = new Set([0xff_fe, 0xff_ff]);

/** Whether XML 1.0 can hold a code point (lone surrogates cannot). */
const isXmlCharacter = (code: number): boolean =>
  (code >= FIRST_PRINTABLE ||
    code === TAB ||
    code === LINE_FEED ||
    code === CARRIAGE_RETURN) &&
  !(code >= SURROGATES[0] && code <= SURROGATES[1]) &&
  !NON_CHARACTERS.has(code);

/** Text an XML file can hold, escaped; characters it cannot hold are dropped. */
const xml = (value: string): string =>
  Array.from(value)
    .filter((character) => isXmlCharacter(character.codePointAt(0) ?? 0))
    .join("")
    .replace(XML_UNSAFE, (character) => XML_ESCAPES[character] ?? character);

/** "A", "B", …, "Z", "AA": the column letters of a zero-based index. */
export function xlsxColumnName(index: number): string {
  let name = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
  }
  return name;
}

function cell(
  value: string | number | boolean | null,
  reference: string,
  style: string
): string {
  if (value === null || value === "") {
    return "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

function sheetXml(matrix: XlsxMatrix): string {
  const lines = [matrix.headers, ...matrix.rows];
  const widths = matrix.headers.map((_, column) =>
    Math.min(
      MAX_COLUMN_WIDTH,
      Math.max(
        MIN_COLUMN_WIDTH,
        ...lines.map((line) => String(line[column] ?? "").length + 2)
      )
    )
  );
  const columns = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    )
    .join("");
  const rows = lines
    .map((line, rowIndex) => {
      // The header row uses the bold style (1).
      const style = rowIndex === 0 ? ' s="1"' : "";
      const cells = line
        .map((value, column) =>
          cell(value, `${xlsxColumnName(column)}${rowIndex + 1}`, style)
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${columns ? `<cols>${columns}</cols>` : ""}<sheetData>${rows}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
// Style 0 is the default; style 1 uses the bold font.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const workbookXml = (sheetName: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

// biome-ignore-start lint/suspicious/noBitwiseOperators: CRC-32 is defined on 32-bit words.
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/** The CRC-32 a ZIP entry carries. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}
// biome-ignore-end lint/suspicious/noBitwiseOperators: CRC-32 is defined on 32-bit words.

// 1980-01-01 00:00, the earliest DOS date: files are the same for the same rows.
const DOS_TIME = 0;
const DOS_DATE = 0x21;
const UTF8_NAMES = 0x08_00;

/** A ZIP archive with stored (uncompressed) entries. */
export function zipStore(
  entries: readonly { name: string; data: Uint8Array }[]
): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04_03_4b_50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_NAMES, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02_01_4b_50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, UTF8_NAMES, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, DOS_TIME, true);
    header.setUint16(14, DOS_DATE, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, size, true);
    header.setUint32(24, size, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, entry.data);
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06_05_4b_50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const chunks = [...parts, ...central, new Uint8Array(end.buffer)];
  const archive = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0)
  );
  let position = 0;
  for (const chunk of chunks) {
    archive.set(chunk, position);
    position += chunk.length;
  }
  return archive;
}

/** The .xlsx file's bytes: one worksheet named after the table. */
export function xlsxBytes(
  matrix: XlsxMatrix,
  { sheetName = "Sheet1" }: { sheetName?: string } = {}
): Uint8Array {
  const encoder = new TextEncoder();
  const files: [string, string][] = [
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["xl/workbook.xml", workbookXml(xlsxSheetName(sheetName))],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheetXml(matrix)],
  ];
  return zipStore(
    files.map(([name, text]) => ({ name, data: encoder.encode(text) }))
  );
}

/**
 * The Excel writer the table takes as `excelWriter`: an .xlsx Blob of the
 * export matrix, its worksheet named after the table.
 */
export function writeXlsx(
  matrix: XlsxMatrix,
  options: { sheetName?: string } = {}
): Blob {
  // The archive owns its whole buffer (never a shared one).
  const { buffer } = xlsxBytes(matrix, options);
  return new Blob([buffer as ArrayBuffer], { type: XLSX_MIME_TYPE });
}
