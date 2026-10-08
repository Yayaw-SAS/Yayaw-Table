---
"yayaw-table-workspace": minor
---

Data › Import reads JSON as well as CSV, in React and Vue: a `.json`, `.jsonl` or `.ndjson` file or pasted text holding an array of objects, an object with one list of objects (`{ "records": [...] }`), or JSON Lines. Nested objects become dot-path columns (`address.city`), lists of plain values join with ", ", and invalid JSON shows a translated error with its line (and column when available). Host sources may also answer JSON text. The "CSV file" labels now read "CSV or JSON file"; hosts overriding `import.sourceCsv`, `import.dropHint`, `import.sourceCsvHint` or `import.pasteLabel` keep their text. New label keys: `jsonError`, `jsonErrorLine`, `jsonErrorAt`, `jsonNotRecords`.
