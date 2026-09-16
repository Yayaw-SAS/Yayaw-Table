import { expect, it } from "vitest";
import fixtures from "../../../tests/fixtures/gallery-view.json";
import { createTableViewSnapshot } from "./core";
import type { TableViewConfig } from "./types";

for (const fixture of fixtures) {
  it(`persists ${fixture.input.previewSize} preview size without runtime media configuration`, () => {
    const gallery = {
      ...fixture.input,
      media: { enabled: true, getMedia: () => ({ url: "/image.jpg" }) },
      renderMedia: () => null,
      renderProperties: () => null,
    };
    expect(
      createTableViewSnapshot({
        gallery: gallery as TableViewConfig["gallery"],
      }).gallery
    ).toEqual(fixture.expected ?? undefined);
  });
}
