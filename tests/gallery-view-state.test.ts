import { expect, it } from "bun:test";
import type { TableViewConfig } from "../src/components/ui/yayaw-table/types/view-types";
import { normalizeTableViewConfig } from "../src/components/ui/yayaw-table/utils/table-view-state";
import fixtures from "./fixtures/gallery-view.json";

for (const fixture of fixtures) {
  it(`persists ${fixture.input.previewSize} preview size without runtime media configuration`, () => {
    const gallery = {
      ...fixture.input,
      media: { enabled: true, getMedia: () => ({ url: "/image.jpg" }) },
      renderMedia: () => null,
      renderProperties: () => null,
    };
    expect(
      normalizeTableViewConfig({
        gallery: gallery as TableViewConfig["gallery"],
      }).gallery
    ).toEqual(fixture.expected ?? undefined);
  });
}
