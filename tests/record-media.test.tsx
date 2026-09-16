import { afterEach, expect, it } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DetailValue } from "../src/components/ui/yayaw-table/components/details/detail-value";
import {
  detailDisplay,
  detailLabels,
} from "../src/components/ui/yayaw-table/utils/record-details";
import fixtures from "./fixtures/record-media.json";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
for (const fixture of fixtures) {
  it(`renders safe video consultation: ${fixture.name}`, async () => {
    const field = {
      id: "clip",
      label: "Product video",
      type: "video" as const,
    };
    const display = detailDisplay(
      field,
      fixture.value,
      {},
      "en",
      detailLabels()
    );
    expect(String(display.kind)).toBe(fixture.kind);
    expect(display.href).toBe(fixture.href);
    expect(display.tracks?.length ?? 0).toBe(fixture.tracks);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(() =>
      root.render(
        <DetailValue
          field={field}
          labels={detailLabels()}
          locale="en"
          row={{}}
          value={fixture.value}
        />
      )
    );
    const video = container.querySelector("video");
    expect(Boolean(video)).toBe(fixture.kind === "video");
    if (video) {
      expect(video.getAttribute("src")).toBe(fixture.href ?? null);
      expect(video.hasAttribute("controls")).toBe(true);
      expect(video.hasAttribute("autoplay")).toBe(false);
      expect(video.getAttribute("aria-label")).toBe("Product video");
      expect(video.querySelectorAll('track[kind="captions"]').length).toBe(
        fixture.tracks
      );
      expect(video.getAttribute("poster") ?? undefined).toBe(display.poster);
    }
  });
}
