import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, provide, ref } from "vue";
import { mockAutoPageLayout } from "../../../../tests/fixtures/auto-page-layout";
import { type TableContextValue, tableContextKey } from "../context";
import { useAutoPageSize } from "./use-auto-page-size";

describe("Vue automatic pagination", () => {
  it.each([
    false,
    true,
  ])("resizes, respects fixed choices and cleans up (default auto: %s)", async (defaultAutomatic) => {
    const layout = mockAutoPageLayout(window);
    const pagination = ref({ pageIndex: 0, pageSize: 10 });
    const density = ref("medium");
    const activeViewId = ref("default");
    const Child = defineComponent({
      setup() {
        const root = ref<HTMLElement>();
        const state = useAutoPageSize(root);
        return () =>
          h("div", { ref: root }, [
            h("table", [h("tbody", [h("tr", [h("td", "Record")])])]),
            h("footer", { "data-yayaw-pagination": "" }, [
              h(
                "select",
                {
                  "aria-label": "Rows per page",
                  value: state.automatic.value
                    ? "auto"
                    : String(pagination.value.pageSize),
                  onChange: (event: Event) =>
                    state.selectSize((event.target as HTMLSelectElement).value),
                },
                [
                  h("option", { value: "auto" }, "Automatic"),
                  h("option", { value: "20" }, "20"),
                  h(
                    "option",
                    { value: String(pagination.value.pageSize) },
                    String(pagination.value.pageSize)
                  ),
                ]
              ),
              h("output", String(pagination.value.pageSize)),
            ]),
          ]);
      },
    });
    const Harness = defineComponent({
      setup() {
        provide(tableContextKey, {
          config: {
            table: {
              enableAutoPageSize: true,
              defaultAutoPageSize: defaultAutomatic,
            },
          },
          state: { pagination, density, activeViewId },
        } as unknown as TableContextValue);
        return () => h(Child);
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    const flush = async () => {
      layout.flush();
      await nextTick();
      await flushPromises();
    };
    try {
      await flush();
      expect(wrapper.get("select").element.value).toBe(
        defaultAutomatic ? "auto" : "10"
      );
      await wrapper.get("select").setValue("auto");
      await flush();
      expect(pagination.value.pageSize).toBe(9);
      // Shorter content also narrows an intrinsic-width table on the next page.
      layout.tableWidth(700);
      layout.bodyTop(148);
      layout.rowHeight(20);
      layout.resize(600);
      await flush();
      expect(pagination.value.pageSize).toBe(9);
      layout.bodyTop(132);
      layout.rowHeight(40);
      layout.resize(800);
      await flush();
      expect(pagination.value.pageSize).toBe(14);
      layout.rowHeight(20);
      density.value = "small";
      await nextTick();
      await flush();
      expect(pagination.value.pageSize).toBe(29);
      expect(wrapper.get("select").element.value).toBe("auto");
      await wrapper.get("select").setValue("20");
      layout.resize(600);
      await flush();
      expect(pagination.value.pageSize).toBe(20);
      await wrapper.get("select").setValue("auto");
      await flush();
      activeViewId.value = "another";
      await nextTick();
      await flush();
      expect(wrapper.get("select").element.value === "auto").toBe(
        defaultAutomatic
      );
    } finally {
      wrapper.unmount();
      layout.resize(900);
      expect(layout.pending()).toBe(0);
      layout.restore();
      document.body.replaceChildren();
    }
  });
});
