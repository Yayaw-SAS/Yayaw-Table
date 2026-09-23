import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import fixtures from "../../../../../tests/fixtures/record-presentation.json";
import { defineTableConfig } from "../../config";
import {
  RECORD_MOBILE_QUERY,
  type RecordPresentationConfig,
  resolveRecordPresentation,
} from "../../record-presentation";
import YayawDataTable from "../YayawDataTable.vue";

for (const fixture of fixtures) {
  it(fixture.name, () => {
    expect(
      resolveRecordPresentation(
        fixture.presentation as RecordPresentationConfig | undefined,
        fixture.mobile,
        fixture.legacy as RecordPresentationConfig | undefined
      )
    ).toBe(fixture.expected);
  });
}
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  })
);
const row = { id: "one", name: "Example" };
const form = {
  id: "records",
  presentation: "modal" as const,
  submitMode: "patch" as const,
  fields: [{ name: "name", label: "Name", type: "text" as const }],
};
function configuration(
  presentation?: RecordPresentationConfig,
  selection = false
) {
  return defineTableConfig({
    id: "records",
    presentation,
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      visible: ["name"],
      order: ["name"],
      mandatory: [],
    },
    table: {
      syncUrl: false,
      rowClickMode: "activate",
      enableRowSelection: selection,
      allowDelete: false,
    },
    translations: { namespace: "records", keys: {} },
  });
}
function mountTable(
  presentation?: RecordPresentationConfig,
  selection = false
) {
  const update = vi.fn(async () => ({ success: true }));
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "records",
      config: configuration(presentation, selection),
      data: [row, { id: "two", name: "Other record" }],
      details: { presentation: "modal" },
      getFormConfig: () => form,
      getTableActions: () => ({
        update,
        create: async () => ({ success: true }),
        bulkUpdate: async () => ({ success: true }),
      }),
    },
    attachTo: document.body,
  });
  return { wrapper, update };
}
function button(label: string) {
  const result = new DOMWrapper(document.body)
    .findAll("button")
    .find((item) => item.text().trim() === label);
  if (!result) {
    throw new Error(`Missing ${label}`);
  }
  return result;
}
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
};
for (const presentation of ["drawer", "modal", "inline"] as const) {
  it(`keeps consultation and edit in the same ${presentation} surface, including cancel and save`, async () => {
    const { wrapper, update } = mountTable(presentation);
    await wrapper.get("tbody td").trigger("click");
    await settle();
    const surface = document.querySelector(".yayaw-record-surface");
    expect(surface?.getAttribute("data-presentation")).toBe(presentation);
    await button("Edit").trigger("click");
    await settle();
    expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
    expect(document.querySelectorAll(".yayaw-record-surface")).toHaveLength(1);
    const body = new DOMWrapper(document.body);
    const draft = body.get(".yayaw-record-body input");
    await draft.setValue("Cancelled draft");
    if (presentation === "inline") {
      await wrapper.findAll("tbody tr")[1]?.get("td").trigger("click");
      expect(document.querySelector(".yayaw-record-body input")).toBe(
        draft.element
      );
      expect((draft.element as HTMLInputElement).value).toBe("Cancelled draft");
    }
    await button("Cancel").trigger("click");
    await settle();
    expect(surface?.textContent).toContain("Example");
    expect(update).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Edit").element);
    await button("Edit").trigger("click");
    await settle();
    expect(
      (body.get(".yayaw-record-body input").element as HTMLInputElement).value
    ).toBe("Example");
    await body.get(".yayaw-record-body input").setValue("Updated");
    await button("Save").trigger("submit");
    await settle();
    expect(update).toHaveBeenCalledWith("one", { name: "Updated" }, { row });
    expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
    expect(document.querySelector(".yayaw-detail")).not.toBeNull();
    if (presentation === "inline") {
      await button("Add item").trigger("click");
      await settle();
      expect(document.querySelectorAll(".yayaw-record-surface")).toHaveLength(
        1
      );
      expect(document.querySelector(".yayaw-detail")).toBeNull();
      await button("Cancel").trigger("click");
      await settle();
      expect(document.querySelector(".yayaw-record-surface")).toBeNull();
    }
  });
  it(`applies the shared ${presentation} setting to create ahead of the legacy form setting`, async () => {
    mountTable(presentation);
    await button("Add item").trigger("click");
    await settle();
    expect(
      document
        .querySelector(".yayaw-record-surface")
        ?.getAttribute("data-presentation")
    ).toBe(presentation);
    expect(document.querySelectorAll(".yayaw-record-header")).toHaveLength(1);
    expect(document.querySelector(".yayaw-record-footer")).not.toBeNull();
    expect(document.querySelector('[role="dialog"]') !== null).toBe(
      presentation !== "inline"
    );
  });
  it(`applies the shared ${presentation} setting to the bulk editor`, async () => {
    const { wrapper } = mountTable(presentation, true);
    await wrapper.get('tbody input[type="checkbox"]').setValue(true);
    await settle();
    await button("Bulk edit").trigger("click");
    await settle();
    expect(
      document
        .querySelector("[data-bulk-editor]")
        ?.getAttribute("data-presentation")
    ).toBe(presentation);
    expect(document.querySelectorAll(".yayaw-record-header")).toHaveLength(1);
    expect(document.querySelector(".yayaw-record-footer")).not.toBeNull();
  });
}
it("preserves an edited value and the dialog node across the mobile override", async () => {
  let mobile = false;
  const events = new EventTarget();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query === RECORD_MOBILE_QUERY && mobile;
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }));
  const { wrapper } = mountTable({ desktop: "drawer", mobile: "modal" });
  await wrapper.get("tbody td").trigger("click");
  await button("Edit").trigger("click");
  await settle();
  const surface = document.querySelector(".yayaw-record-surface");
  const input = new DOMWrapper(document.body).get(".yayaw-record-body input");
  await input.setValue("Mobile draft");
  mobile = true;
  events.dispatchEvent(new Event("change"));
  await settle();
  expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
  expect(surface?.getAttribute("data-presentation")).toBe("modal");
  expect(document.querySelector(".yayaw-record-body input")).toBe(
    input.element
  );
  expect((input.element as HTMLInputElement).value).toBe("Mobile draft");
  mobile = false;
  events.dispatchEvent(new Event("change"));
  await settle();
  expect(surface?.getAttribute("data-presentation")).toBe("drawer");
  expect((input.element as HTMLInputElement).value).toBe("Mobile draft");
});

it("preserves the embedded editor and its value when mobile uses inline", async () => {
  let mobile = false;
  const events = new EventTarget();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query === RECORD_MOBILE_QUERY && mobile;
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }));
  const { wrapper } = mountTable({ desktop: "drawer", mobile: "inline" });
  await wrapper.get("tbody td").trigger("click");
  await button("Edit").trigger("click");
  await settle();
  const input = new DOMWrapper(document.body).get(".yayaw-record-body input");
  await input.setValue("Preserved embedded draft");
  mobile = true;
  events.dispatchEvent(new Event("change"));
  await settle();
  expect(document.querySelector(".yayaw-record-body input")).toBe(
    input.element
  );
  expect((input.element as HTMLInputElement).value).toBe(
    "Preserved embedded draft"
  );
  expect(
    document
      .querySelector(".yayaw-record-surface")
      ?.getAttribute("data-presentation")
  ).toBe("inline");
  mobile = false;
  events.dispatchEvent(new Event("change"));
  await settle();
  expect(document.querySelector(".yayaw-record-body input")).toBe(
    input.element
  );
  expect((input.element as HTMLInputElement).value).toBe(
    "Preserved embedded draft"
  );
});
