import { expect, it } from "bun:test";
import {
  areViewSettingsEqual,
  getViewModeCapabilities,
  sharePageUrl,
} from "../src/components/ui/yayaw-table/utils/view-menu";
import fixtures from "./fixtures/view-menu.json";

for (const fixture of fixtures) {
  it(`shared view comparison: ${fixture.name}`, () => {
    expect(areViewSettingsEqual(fixture.saved, fixture.current)).toBe(
      fixture.equal
    );
  });
}

it("shares presentation capabilities between the frameworks", () => {
  expect(getViewModeCapabilities("table")).toMatchObject({
    columns: true,
    density: true,
    calculations: true,
    maxGroups: 2,
  });
  for (const mode of ["kanban", "gallery"] as const) {
    expect(getViewModeCapabilities(mode)).toMatchObject({
      columns: false,
      density: false,
      calculations: false,
      maxGroups: 1,
    });
  }
});

it("copies the exact current URL on desktop and uses native sharing on mobile", async () => {
  const calls: string[] = [];
  const url = "https://example.com/products?view=open&products-q=Atlas#records";
  const environment = {
    share: (data: { url: string }) => {
      calls.push(`share:${data.url}`);
      return Promise.resolve();
    },
    clipboard: {
      writeText: (text: string) => {
        calls.push(`copy:${text}`);
        return Promise.resolve();
      },
    },
  };
  expect(await sharePageUrl(url, false, environment)).toBe("copied");
  expect(await sharePageUrl(url, true, environment)).toBe("shared");
  expect(calls).toEqual([`copy:${url}`, `share:${url}`]);
});

it("silences native cancellation and falls back to clipboard for unavailable sharing", async () => {
  const copies: string[] = [];
  const clipboard = {
    writeText: (text: string) => {
      copies.push(text);
      return Promise.resolve();
    },
  };
  const cancel = Object.assign(new Error("Dismissed"), { name: "AbortError" });
  expect(
    await sharePageUrl("/current", true, {
      clipboard,
      share: () => Promise.reject(cancel),
    })
  ).toBe("cancelled");
  expect(copies).toEqual([]);
  expect(await sharePageUrl("/current", true, { clipboard })).toBe("copied");
  expect(
    await sharePageUrl("/fallback", true, {
      clipboard,
      share: () => Promise.reject(new Error("Unavailable")),
    })
  ).toBe("copied");
  expect(copies).toEqual(["/current", "/fallback"]);
  await expect(sharePageUrl("/current", false, {})).rejects.toThrow(
    "unavailable"
  );
});
