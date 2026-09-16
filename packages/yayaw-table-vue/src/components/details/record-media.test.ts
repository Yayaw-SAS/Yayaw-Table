import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import fixtures from "../../../../../tests/fixtures/record-media.json";
import { detailDisplay, detailLabels } from "../../record-details";
import DetailValue from "./DetailValue.vue";

for (const fixture of fixtures) {
  it(`renders safe video consultation: ${fixture.name}`, () => {
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
    expect(display.kind).toBe(fixture.kind);
    expect(display.href).toBe(fixture.href);
    expect(display.tracks?.length ?? 0).toBe(fixture.tracks);
    const wrapper = mount(DetailValue, {
      props: {
        field,
        value: fixture.value,
        row: {},
        locale: "en",
        labels: detailLabels(),
      },
    });
    const video = wrapper.find("video");
    expect(video.exists()).toBe(fixture.kind === "video");
    if (video.exists()) {
      expect(video.attributes("src")).toBe(fixture.href);
      expect(video.attributes("controls")).toBeDefined();
      expect(video.attributes("autoplay")).toBeUndefined();
      expect(video.attributes("aria-label")).toBe("Product video");
      expect(video.findAll('track[kind="captions"]').length).toBe(
        fixture.tracks
      );
      expect(video.attributes("poster")).toBe(display.poster);
    }
    wrapper.unmount();
  });
}
