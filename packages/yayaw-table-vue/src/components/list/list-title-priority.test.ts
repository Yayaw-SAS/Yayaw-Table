import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import YayawDataTable from "../YayawDataTable.vue";

const styles = readFileSync(
  new NodeURL("../../styles.css", import.meta.url),
  "utf8"
);
const WHITESPACE_PATTERN = /\s+/g;

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (selector: string): string => {
  const start = styles.indexOf(`\n${selector} {`);
  if (start < 0) {
    return "";
  }
  const open = styles.indexOf("{", start);
  return styles
    .slice(open + 1, styles.indexOf("}", open))
    .replace(WHITESPACE_PATTERN, " ");
};

const rows = [
  {
    id: "one",
    name: "Luc Gauthier",
    email: "luc.gauthier@an-unusually-long-company-domain.example",
  },
];

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  })
);
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

const mountList = async (propertyAlign: "end" | "start") => {
  const config = defineTableConfig({
    id: "people",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "email", header: "Email", type: "text" },
      ],
      visible: ["name", "email"],
      order: ["name", "email"],
      mandatory: ["name"],
    },
    table: {
      displayModes: ["list"],
      defaultDisplayMode: "list",
      list: { titleColumn: "name", propertyAlign },
      showToolbar: false,
    },
    translations: { namespace: "people", keys: {} },
  });
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: { config, data: rows, tableType: "people", syncUrl: false },
  });
  await flushPromises();
  const properties = wrapper.get("li dl.yayaw-list-properties");
  const title = properties.element.previousElementSibling;
  return { properties, title };
};

it("list lines keep the title readable: it keeps its width while properties give way first", async () => {
  const { properties, title } = await mountList("end");
  expect(title?.textContent).toBe("Luc Gauthier");
  expect(title?.classList.contains("yayaw-list-title")).toBe(true);
  expect(title?.classList.contains("yayaw-list-title-start")).toBe(false);
  expect(properties.attributes("data-align")).toBe("end");
  // Auto basis (not `flex: 1`'s 0 basis), so the title is not left with only the leftover.
  expect(rule(".yayaw-list-title")).toContain("flex: 1 1 auto;");
  expect(rule(".yayaw-list-title")).toContain("min-width: 0;");
  // Properties shrink faster than the title and never fill the whole line.
  expect(rule(".yayaw-list-properties")).toContain("flex: 0 3 auto;");
  expect(rule(".yayaw-list-properties")).toContain("max-width: 60%;");
});

it("start-aligned list lines still put properties right after the title, capped", async () => {
  const { properties, title } = await mountList("start");
  expect(title?.classList.contains("yayaw-list-title-start")).toBe(true);
  expect(properties.attributes("data-align")).toBe("start");
  expect(rule(".yayaw-list-title.yayaw-list-title-start")).toContain(
    "flex: 0 1 auto;"
  );
  expect(rule('.yayaw-list-properties[data-align="start"]')).toContain(
    "flex: 1;"
  );
  expect(rule(".yayaw-list-properties")).toContain("max-width: 60%;");
});
