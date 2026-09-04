import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import type { TableActions, TableBehaviorConfig } from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

const mountTable = (
  actions: TableActions,
  table: Partial<TableBehaviorConfig> = {}
) =>
  mount(YayawDataTable, {
    props: {
      tableType: "keyboard",
      locale: "fr",
      data: [{ id: "1", name: "Alpha" }],
      config: defineTableConfig({
        id: "keyboard",
        translations: { namespace: "keyboard", keys: {} },
        columns: {
          definitions: [{ id: "name", header: "Name" }],
          order: ["name"],
          visible: ["name"],
          mandatory: [],
        },
        table: { syncUrl: false, enableViews: false, ...table },
      }),
      getTableActions: () => actions,
    },
    attachTo: document.body,
    global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
  });
const body = () => new DOMWrapper(document.body);
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));
const settleFocus = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

it("opens from the keyboard, skips disabled actions and restores the trigger on Escape", async () => {
  const wrapper = mountTable(
    { update: vi.fn(), duplicate: vi.fn(), delete: vi.fn() },
    { canEditRow: () => false }
  );
  const trigger = wrapper.get('[aria-label="Ouvrir le menu des actions"]');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("keydown", { key: "Enter" });
  await settleFocus();
  const items = body().findAll('[role="menuitem"]');
  expect(items[0]?.attributes("disabled")).toBeDefined();
  expect(document.activeElement?.textContent).toContain("Dupliquer");
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    {
      key: "ArrowDown",
    }
  );
  await settleFocus();
  expect(document.activeElement?.textContent).toContain("Supprimer");
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    {
      key: "Escape",
    }
  );
  await settleFocus();
  expect(body().find('[role="menu"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
});

it("opens a translated modal confirmation, traps focus and allows retry after a failed delete", async () => {
  let fail = true;
  const remove = vi.fn(() => ({
    success: !fail,
    error: fail ? "Accès refusé" : undefined,
  }));
  const wrapper = mountTable({ delete: remove });
  const trigger = wrapper.get('[aria-label="Ouvrir le menu des actions"]');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("keydown", { key: "Enter" });
  await settleFocus();
  await body().get('[role="menuitem"]').trigger("keydown", { key: "Enter" });
  await settleFocus();
  const dialog = body().get('[role="alertdialog"]');
  expect(dialog.text()).toContain("Supprimer la ligne ?");
  expect(dialog.text()).toContain("Cette action est irréversible.");
  expect(dialog.element.contains(document.activeElement)).toBe(true);
  const confirm = dialog.get(".yayaw-button-danger");
  (confirm.element as HTMLElement).focus();
  await confirm.trigger("keydown", { key: "Tab" });
  await settleFocus();
  expect(dialog.element.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(confirm.element);
  await confirm.trigger("click");
  await flushPromises();
  expect(dialog.get('[role="alert"]').text()).toBe("Accès refusé");
  expect(remove).toHaveBeenCalledExactlyOnceWith("1");
  fail = false;
  await confirm.trigger("click");
  await settleFocus();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(body().find('[role="alertdialog"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
});
