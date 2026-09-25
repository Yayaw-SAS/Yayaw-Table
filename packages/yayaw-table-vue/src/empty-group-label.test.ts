import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";

enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

const rows = [
  { id: "1", name: "Alpha", status: "Open" },
  { id: "2", name: "Beta", status: null },
  { id: "3", name: "Gamma" },
];
const headings = {
  kanban: ".yayaw-kanban-lane header strong",
  gallery: ".yayaw-gallery-section h3",
  list: ".yayaw-list-section h3",
} as const;

it.each([
  ["kanban", "en", "No value"],
  ["gallery", "en", "No value"],
  ["list", "en", "No value"],
  ["kanban", "fr", "Aucune valeur"],
  ["gallery", "fr", "Aucune valeur"],
  ["list", "fr", "Aucune valeur"],
] as const)("heads the %s group without a value in %s", async (mode, locale, label) => {
  window.history.replaceState(
    {},
    "",
    `/?empty-grouping=${encodeURIComponent(JSON.stringify(["status"]))}`
  );
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "empty",
      locale,
      data: rows,
      config: defineTableConfig({
        id: "empty",
        columns: {
          mandatory: ["name"],
          definitions: [
            { id: "name", header: "Name", type: "text" },
            { id: "status", header: "Status", type: "text" },
          ],
          visible: ["name", "status"],
          order: ["name", "status"],
        },
        table: {
          displayModes: ["table", "kanban", "gallery", "list"],
          defaultDisplayMode: mode,
          enableGrouping: true,
          enablePagination: false,
          kanban: { groupBy: "status", titleColumn: "name" },
        },
        translations: { namespace: "empty", keys: {} },
      }),
    },
  });
  await flushPromises();
  const texts = wrapper
    .findAll(headings[mode])
    .map((heading) => heading.text());
  expect(texts).toHaveLength(2);
  expect(texts[0]).toContain("Open");
  expect(texts[1]).toContain(label);
  expect(texts.join(" ")).not.toContain("Unassigned");
});
