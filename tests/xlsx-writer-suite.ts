import assert from "node:assert/strict";
import type * as Writer from "../src/components/ui/yayaw-table-excel/xlsx-writer";

const LOCAL_HEADER = 0x04_03_4b_50;
const CENTRAL_HEADER = 0x02_01_4b_50;
const END_OF_CENTRAL_DIRECTORY = 0x06_05_4b_50;

/** Fails the test that reads an archive this suite cannot trust. */
function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Invalid ZIP: ${message}`);
  }
}

/** The entries of a stored (uncompressed) ZIP, checked against their CRC. */
function unzipStored(
  bytes: Uint8Array,
  crc32: (data: Uint8Array) => number
): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const decoder = new TextDecoder();
  const entries = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === LOCAL_HEADER) {
    check(view.getUint16(offset + 8, true) === 0, "an entry is compressed");
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + size);
    check(crc32(data) === crc, "a checksum differs");
    entries.set(
      decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      decoder.decode(data)
    );
    offset = dataStart + size;
  }
  const end = bytes.length - 22;
  check(
    view.getUint32(offset, true) === CENTRAL_HEADER,
    "no central directory"
  );
  check(
    view.getUint32(end, true) === END_OF_CENTRAL_DIRECTORY &&
      view.getUint16(end + 10, true) === entries.size &&
      view.getUint32(end + 16, true) === offset,
    "the end record does not match the entries"
  );
  return entries;
}

export function xlsxWriterSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  writer: Pick<
    typeof Writer,
    | "crc32"
    | "writeXlsx"
    | "XLSX_MIME_TYPE"
    | "xlsxBytes"
    | "xlsxColumnName"
    | "xlsxSheetName"
  >
) {
  const matrix = {
    headers: ["Name", "Price", "Paid", "Note"],
    rows: [
      ["Alpha & <b>", 12.5, true, null],
      ["=SUM(A1)", -3, "No", "line\u0001break"],
    ],
  };

  test("computes the ZIP checksum and Excel's column letters", () => {
    assert.equal(
      writer.crc32(new TextEncoder().encode("hello")),
      0x36_10_a6_86
    );
    assert.deepEqual([0, 25, 26, 701, 702].map(writer.xlsxColumnName), [
      "A",
      "Z",
      "AA",
      "ZZ",
      "AAA",
    ]);
  });

  test("names the worksheet within Excel's rules", () => {
    assert.equal(
      writer.xlsxSheetName("Projets: été/2026 [Q3]?"),
      "Projets été 2026 Q3"
    );
    assert.equal(writer.xlsxSheetName("'Quoted'"), "Quoted");
    assert.equal(writer.xlsxSheetName(" :/ "), "Sheet1");
    assert.equal(writer.xlsxSheetName("x".repeat(40)).length, 31);
  });

  test("packs a workbook with one worksheet in a stored ZIP", () => {
    const files = unzipStored(
      writer.xlsxBytes(matrix, { sheetName: "Projects" }),
      writer.crc32
    );
    assert.deepEqual(
      [...files.keys()],
      [
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
      ]
    );
    assert.ok(
      files
        .get("xl/workbook.xml")
        ?.includes('<sheet name="Projects" sheetId="1"')
    );
    // Style 1, the header's, is bold.
    assert.ok(files.get("xl/styles.xml")?.includes('<font><b/><sz val="11"/>'));
  });

  test("writes a bold header, numbers as numbers and the rest as text", () => {
    const sheet =
      unzipStored(writer.xlsxBytes(matrix), writer.crc32).get(
        "xl/worksheets/sheet1.xml"
      ) ?? "";
    assert.ok(
      sheet.includes(
        '<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>'
      )
    );
    assert.ok(sheet.includes('<c r="B2"><v>12.5</v></c>'));
    assert.ok(sheet.includes('<c r="B3"><v>-3</v></c>'));
    // Text is escaped and never a formula; empty cells are left out.
    assert.ok(sheet.includes(">Alpha &amp; &lt;b&gt;</t>"));
    assert.ok(sheet.includes(">=SUM(A1)</t>"));
    assert.ok(!sheet.includes("<f>"));
    assert.ok(
      sheet.includes(
        '<c r="C2" t="inlineStr"><is><t xml:space="preserve">true</t>'
      )
    );
    assert.ok(!sheet.includes('r="D2"'));
    // Characters XML cannot hold are dropped.
    assert.ok(sheet.includes(">linebreak</t>"));
    assert.ok(
      sheet.includes('<col min="1" max="1" width="13" customWidth="1"/>')
    );
  });

  test("returns an .xlsx Blob", () => {
    const file = writer.writeXlsx(matrix, { sheetName: "Projects" });
    assert.equal(file.type, writer.XLSX_MIME_TYPE);
    assert.ok(file.size > 0);
  });
}
