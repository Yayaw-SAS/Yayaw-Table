import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { expect, it } from "vitest";

const styles = readFileSync(new NodeURL("../../styles.css", import.meta.url), "utf8");
const zIndex = (selector: string) =>
  Number(styles.match(new RegExp(`\\n${selector.replace(/[.]/g, "\\.")} \\{[^}]*?z-index: (\\d+)`))?.[1]);

it("opens searchable select lists above record drawers and dialogs", () => {
  // A form select of more than 200 options (countries) listed under the drawer it was opened from.
  expect(zIndex(".yayaw-inline-options")).toBeGreaterThan(zIndex(".yayaw-dialog-backdrop"));
});
