import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { defineTableConfig } from "../../config";
import {
  type DetailRelatedSection,
  deleteConfirmationMatches,
  deleteConfirmationValue,
  detailLabels,
  detailLayout,
  loadRelatedRecords,
  type RecordDetailsConfig,
  relatedView,
} from "../../record-details";
import type { TableActions } from "../../types";
import YayawDataTable from "../YayawDataTable.vue";
import RecordDetails from "./RecordDetails.vue";

const company = {
  id: "c1",
  name: "Northwind",
  code: "NW-1",
  extra: { industry: "Retail" },
};
const people = [
  { id: "p1", name: "Zoé", companyId: "c1", role: "Buyer" },
  { id: "p2", name: "Adam", companyId: "c1", role: "Owner" },
  { id: "p3", name: "Other", companyId: "c2", role: "Owner" },
  { id: "p4", name: "Bea", companyId: ["c3", "c1"], role: "Advisor" },
];
const peopleSection: DetailRelatedSection = {
  kind: "related",
  id: "people",
  title: "People",
  source: "people",
  foreignKey: "companyId",
  columns: [
    { id: "name", label: "Name" },
    { id: "role", label: "Role" },
  ],
  sort: { id: "name" },
  limit: 2,
  rows: people,
  open: { action: "open-person" },
  add: { action: "add-person", label: "Add person" },
};
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));
const body = () => new DOMWrapper(document.body);
const button = (scope: Pick<DOMWrapper<Element>, "findAll">, text: string) => {
  const found = scope.findAll("button").find((item) => item.text() === text);
  if (!found) {
    throw new Error(`Missing button: ${text}`);
  }
  return found;
};
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("record details extensions", () => {
  it("resolves typed confirmation values for records and bulk deletions", () => {
    const labels = detailLabels("en");
    expect(
      deleteConfirmationValue(undefined, { row: company, title: "N" }, labels)
    ).toBeUndefined();
    expect(
      deleteConfirmationValue(
        { type: "typed" },
        { row: company, title: "Northwind" },
        labels
      )
    ).toBe("Northwind");
    expect(
      deleteConfirmationValue(
        { type: "typed", match: "column", column: "code" },
        { row: company, title: "Northwind" },
        labels
      )
    ).toBe("NW-1");
    expect(
      deleteConfirmationValue(
        { type: "typed", match: "column", column: "missing" },
        { row: company, title: "Northwind" },
        labels
      )
    ).toBe("DELETE");
    expect(
      deleteConfirmationValue(
        { type: "typed", match: "text", text: "erase" },
        { row: company, title: "Northwind" },
        labels
      )
    ).toBe("erase");
    expect(
      deleteConfirmationValue({ type: "typed" }, { count: 3 }, labels)
    ).toBe("3");
    expect(
      deleteConfirmationValue(
        { type: "typed", bulkMatch: "text" },
        { count: 3 },
        detailLabels("fr")
      )
    ).toBe("SUPPRIMER");
    expect(deleteConfirmationMatches("NW-1", " nw-1 ")).toBe(true);
    expect(
      deleteConfirmationMatches("NW-1", "nw-1", { caseSensitive: true })
    ).toBe(false);
    expect(deleteConfirmationMatches(undefined, "")).toBe(true);
  });

  it("lays out related and custom sections after the derived fields", async () => {
    const layout = detailLayout(
      {
        sections: [
          peopleSection,
          { kind: "custom", id: "extra", title: "Extra" },
          { kind: "custom", id: "hidden", title: "Hidden", hidden: true },
        ],
      },
      [{ id: "name", header: "Name", type: "text" }],
      company,
      "Details"
    );
    expect(layout.map((item) => `${item.kind}:${item.section.id}`)).toEqual([
      "fields:record",
      "related:people",
      "custom:extra",
    ]);
    const rows = await loadRelatedRecords(peopleSection, company);
    expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p4"]);
    const view = relatedView(peopleSection, rows);
    expect(view.rows.map((row) => row.name)).toEqual(["Adam", "Bea"]);
    expect(view.total).toBe(3);
  });

  it("requires the typed title before deleting a record", async () => {
    const remove = vi.fn(() => ({ success: true }));
    const config: RecordDetailsConfig = {
      presentation: "inline",
      deleteConfirmation: { type: "typed" },
      sections: [
        { id: "main", title: "Main", fields: [{ id: "code", label: "Code" }] },
      ],
    };
    const wrapper = mount(RecordDetails, {
      props: {
        row: company,
        config,
        canDelete: true,
        onDelete: remove,
      },
      attachTo: document.body,
    });
    await button(body(), "Delete").trigger("click");
    await settle();
    const dialog = body().get('[role="alertdialog"]');
    const input = dialog.get<HTMLInputElement>("input");
    expect(document.activeElement).toBe(input.element);
    expect(dialog.get(`label[for="${input.element.id}"]`).text()).toBe(
      "Type “Northwind” to confirm."
    );
    const confirm = button(dialog, "Delete");
    expect(confirm.attributes("disabled")).toBeDefined();
    await input.setValue("North");
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(dialog.text()).toContain("The text does not match.");
    await confirm.trigger("click");
    expect(remove).not.toHaveBeenCalled();
    await input.setValue("northwind");
    expect(confirm.attributes("disabled")).toBeUndefined();
    await input.trigger("keydown", { key: "Enter" });
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("deleted")).toHaveLength(1);
  });

  it("lists related records lazily with host actions, empty and error states", async () => {
    const onRelatedAction = vi.fn((_event: unknown) => undefined);
    let failures = 1;
    const loadRelated = vi.fn(async (..._args: unknown[]) => {
      await Promise.resolve();
      if (failures > 0) {
        failures -= 1;
        throw new Error("Server unavailable");
      }
      return [{ id: "d1", title: "Renewal", amount: 1200 }];
    });
    const config: RecordDetailsConfig = {
      presentation: "inline",
      loadRelated,
      onRelatedAction,
      sections: [
        { id: "main", title: "Main", fields: [{ id: "name", label: "Name" }] },
        peopleSection,
        {
          kind: "related",
          id: "deals",
          title: "Deals",
          source: "deals",
          foreignKey: "companyId",
          columns: [
            { id: "title", label: "Deal" },
            { id: "amount", label: "Amount", type: "number" },
          ],
          collapsed: true,
        },
        {
          kind: "related",
          id: "none",
          title: "Notes",
          source: "notes",
          foreignKey: "companyId",
          columns: [{ id: "text", label: "Text" }],
          rows: [],
          empty: "No notes yet.",
        },
      ],
    };
    const wrapper = mount(RecordDetails, {
      props: { row: company, config },
      attachTo: document.body,
    });
    await settle();
    const section = wrapper.get('[data-related-section="people"]');
    expect(section.get("h3").text()).toBe("People3");
    expect(
      section.findAll("tbody tr").map((row) => row.find("td").text())
    ).toEqual(["Adam", "Bea"]);
    expect(section.text()).toContain("1 more");
    expect(wrapper.text()).toContain("No notes yet.");
    await button(section, "Add person").trigger("click");
    await button(section, "Open").trigger("click");
    expect(onRelatedAction.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({
        action: "add-person",
        kind: "add",
        row: company,
      }),
      expect.objectContaining({
        action: "open-person",
        kind: "open",
        related: expect.objectContaining({ id: "p2" }),
      }),
    ]);
    // A closed section loads once opened.
    expect(loadRelated).not.toHaveBeenCalled();
    const deals = wrapper.get('[data-related-section="deals"]');
    const toggle = deals.get("h3 button");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await toggle.trigger("click");
    await settle();
    expect(loadRelated).toHaveBeenCalledTimes(1);
    expect(loadRelated.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ value: "c1" })
    );
    expect(deals.get('[role="alert"]').text()).toContain("Server unavailable");
    await button(deals, "Retry").trigger("click");
    await settle();
    expect(loadRelated).toHaveBeenCalledTimes(2);
    expect(deals.get("tbody").text()).toContain("Renewal");
  });

  it("renders host fields and custom sections through slots", async () => {
    const config: RecordDetailsConfig = {
      presentation: "inline",
      sections: [
        {
          id: "main",
          title: "Main",
          fields: [
            { id: "name", label: "Name" },
            { id: "extra.industry", label: "Industry", type: "custom" },
          ],
        },
        {
          kind: "custom",
          id: "custom-fields",
          title: "Custom fields",
          data: { column: "extra" },
        },
        { kind: "custom", id: "unrendered", title: "Unrendered" },
      ],
    };
    const wrapper = mount(RecordDetails, {
      props: { row: company, config },
      slots: {
        "detail-field": ({
          field,
          value,
        }: {
          field: { type?: string };
          value: unknown;
        }) => (field.type === "custom" ? h("em", String(value)) : undefined),
        "record-section-custom-fields": ({
          row,
          section,
        }: {
          row: Record<string, unknown>;
          section: { data?: Record<string, unknown> };
        }) =>
          h(
            "p",
            { "data-host-section": "" },
            Object.keys(row[String(section.data?.column)] as object).join(",")
          ),
      },
      attachTo: document.body,
    });
    await settle();
    expect(wrapper.get("em").text()).toBe("Retail");
    expect(wrapper.text()).toContain("Northwind");
    expect(wrapper.get("[data-host-section]").text()).toBe("industry");
    expect(wrapper.text()).toContain("Custom fields");
    expect(wrapper.text()).not.toContain("Unrendered");
  });

  it("asks a typed confirmation for row and bulk deletions in a table", async () => {
    const rows = [
      { id: "r1", name: "Alpha", code: "A-1" },
      { id: "r2", name: "Beta", code: "B-2" },
    ];
    const remove = vi.fn(async () => ({ success: true }));
    const bulkDelete = vi.fn(async () => ({ success: true }));
    const actions: TableActions = { delete: remove, bulkDelete };
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "typed-delete",
        data: rows,
        details: false,
        config: defineTableConfig({
          id: "typed-delete",
          translations: { namespace: "typed-delete", keys: {} },
          columns: {
            definitions: [{ id: "name", header: "Name" }],
            order: ["select", "name"],
            visible: ["name"],
            mandatory: [],
          },
          table: {
            syncUrl: false,
            enableViews: false,
            allowEdit: false,
            allowDuplicate: false,
            deleteConfirmation: {
              type: "typed",
              match: "column",
              column: "code",
            },
          },
        }),
        getTableActions: () => actions,
      },
      attachTo: document.body,
      global: {
        stubs: {
          PopperArrow: true,
          PopperContent: { template: "<div><slot /></div>" },
        },
      },
    });
    await settle();
    const trigger = wrapper.get('[aria-label="Open actions menu"]');
    await trigger.trigger("keydown", { key: "Enter" });
    await settle();
    await body().get('[role="menuitem"]').trigger("keydown", { key: "Enter" });
    await settle();
    const dialog = body().get('[role="alertdialog"]');
    const input = dialog.get<HTMLInputElement>(
      "input[data-typed-confirmation]"
    );
    expect(dialog.text()).toContain("Type “A-1” to confirm.");
    expect(document.activeElement).toBe(input.element);
    const confirm = dialog.get(".yayaw-button-danger");
    expect(confirm.attributes("disabled")).toBeDefined();
    await input.setValue("a-1");
    await confirm.trigger("click");
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);

    await wrapper.get('tbody input[type="checkbox"]').setValue(true);
    await settle();
    await wrapper.get('.yayaw-bulk-bar [aria-label="Delete"]').trigger("click");
    await settle();
    const bulk = wrapper.get('[role="alertdialog"]');
    const bulkInput = bulk.get<HTMLInputElement>(
      "input[data-typed-confirmation]"
    );
    expect(bulk.text()).toContain("Type “1” to confirm.");
    expect(document.activeElement).toBe(bulkInput.element);
    const bulkConfirm = bulk.get(".yayaw-button-danger");
    expect(bulkConfirm.attributes("disabled")).toBeDefined();
    await bulkInput.setValue("1");
    await bulkConfirm.trigger("click");
    await settle();
    expect(bulkDelete).toHaveBeenCalledExactlyOnceWith(["r1"]);
  });
});
