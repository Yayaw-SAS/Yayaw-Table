import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import OptionIcon from "./components/OptionIcon.vue";
import { getOptionIconUrl, optionIconStyle } from "./option-icon";

it("reads the icon URL without adding icons to options without one", () => {
  expect(getOptionIconUrl({ iconUrl: "/media.svg" })).toBe("/media.svg");
  expect(getOptionIconUrl({ iconUrl: "" })).toBeUndefined();
  expect(getOptionIconUrl({ label: "Media" })).toBeUndefined();
});

it("uses the URL as a CSS mask and encodes quotes", () => {
  expect(optionIconStyle('/media"icon.svg')).toEqual({
    maskImage: 'url("/media%22icon.svg")',
  });
});

it("shows a decorative mask only when the option has an icon", async () => {
  const icon = mount(OptionIcon, {
    props: { option: { iconUrl: "/media.svg" } },
  });
  expect(icon.attributes("aria-hidden")).toBe("true");
  expect(icon.attributes("style")).toContain("mask-image:");
  await icon.setProps({ option: {} });
  expect(icon.find("span").exists()).toBe(false);
});
