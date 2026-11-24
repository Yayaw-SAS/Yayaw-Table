import { expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OptionIcon } from "../components/option-icon";
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

it("shows a decorative mask only when the option has an icon", () => {
  const markup = renderToStaticMarkup(
    createElement(OptionIcon, { option: { iconUrl: "/media.svg" } })
  );
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain("mask-image:url(");
  expect(renderToStaticMarkup(createElement(OptionIcon, { option: {} }))).toBe(
    ""
  );
});
