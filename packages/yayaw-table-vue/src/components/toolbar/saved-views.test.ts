import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import {
  inlineTestPortals,
  openViewMenu,
  openViewSave,
} from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import type {
  TableBehaviorConfig,
  TableView,
  TableViewActionResult,
  TableViewActions,
} from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

const config = defineTableConfig({
  id: "view-test",
  translations: { namespace: "views", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      { id: "status", header: "Status" },
    ],
    mandatory: [],
    visible: ["name", "status"],
    order: ["name", "status"],
  },
  table: {
    enableViews: true,
    allowViewSave: true,
    allowViewSharing: true,
    syncUrl: false,
    displayModes: ["table", "gallery"],
    gallery: { titleColumn: "name", cardSize: "small" },
    kanban: { groupBy: "status", titleColumn: "name" },
  },
});
const saved: TableView = {
  id: "mine",
  tableId: config.id,
  name: "My view",
  config: { globalSearch: "Alpha" },
};
const mountTable = (
  input: {
    views?: TableView[];
    actions?: TableViewActions;
    active?: string;
    syncUrl?: boolean;
    table?: Partial<TableBehaviorConfig>;
    locale?: string;
    translations?: Record<string, string>;
  } = {}
) =>
  mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config: defineTableConfig({
        ...config,
        table: { ...config.table, ...input.table },
      }),
      tableType: "products",
      data: [
        { id: "1", name: "Alpha", status: "open" },
        { id: "2", name: "Beta", status: "closed" },
      ],
      initialViews: input.views ?? [],
      initialActiveViewId: input.active,
      getTableActions: () => ({ views: input.actions }),
      syncUrl: input.syncUrl ?? false,
      locale: input.locale,
      translations: input.translations,
    },
    // Keep Reka's keyboard/menu behavior while avoiding jsdom layout measurements.
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;
const body = () => new DOMWrapper(document.body);
const search = (wrapper: Wrapper) => wrapper.get('input[type="search"]');
const saveButton = async (wrapper: Wrapper) => {
  await openViewMenu(wrapper);
  return wrapper.get('[aria-label="Save changes"]');
};
const current = (wrapper: Wrapper) => wrapper.get(".yayaw-view-trigger");
const openMenu = openViewMenu;
const favoriteAction = async (wrapper: Wrapper, selector: string) => {
  await openViewMenu(wrapper);
  return wrapper.get(`button${selector}`);
};
const choose = async (text: string) => {
  const item = body()
    .findAll(".yayaw-view-menu-item")
    .find((item) => item.text() === text);
  if (!item) {
    throw new Error(`Missing view menu item: ${text}`);
  }
  await item.trigger("click");
  await flushPromises();
};
const openSave = async (wrapper: Wrapper) => {
  await openViewSave(wrapper);
  await flushPromises();
};
const setName = async (name: string) => {
  await body().get(".yayaw-view-form input:not([type])").setValue(name);
};
const submit = async () => {
  await body().get(".yayaw-view-form").trigger("submit");
  await flushPromises();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    localStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
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

it("uses compact controls, selects views with the keyboard menu, and restores catalogue defaults", async () => {
  const wrapper = mountTable({ views: [saved] });
  await flushPromises();
  expect(current(wrapper).text()).toBe("Default view");
  expect(wrapper.find(".yayaw-views select").exists()).toBe(false);
  expect(wrapper.find('[aria-label="Save changes"]').exists()).toBe(false);
  await openMenu(wrapper);
  await choose("My view");
  expect(current(wrapper).text()).toBe("My view");
  expect(search(wrapper).element).toHaveProperty("value", "Alpha");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  await search(wrapper).setValue("Beta");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
  await search(wrapper).setValue("Alpha");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  await openMenu(wrapper);
  await choose("Default view");
  expect(search(wrapper).element).toHaveProperty("value", "");
  expect(current(wrapper).text()).toBe("Default view");
});

it("creates a local shared view in a modal, retains its options after remount, and deletes it", async () => {
  const wrapper = mountTable();
  await flushPromises();
  await search(wrapper).setValue("Beta");
  await openSave(wrapper);
  expect(body().get('[role="dialog"]').text()).toContain(
    "Save the current filters"
  );
  await setName("Team Beta");
  await body().get(".yayaw-view-share input").setValue(true);
  await submit();
  expect(body().find('[role="dialog"]').exists()).toBe(false);
  expect(current(wrapper).text()).toBe("Team Beta");
  expect(toast.getHistory().at(-1)).toMatchObject({
    type: "success",
    title: "View created",
  });
  expect(wrapper.find(".yayaw-status").exists()).toBe(false);
  const persisted = JSON.parse(
    localStorage.getItem("yayaw-table:view-test:views") ?? "[]"
  );
  expect(persisted[0]).toMatchObject({
    tableId: config.id,
    tableType: "products",
    isGlobal: true,
    config: { globalSearch: "Beta", grouping: [] },
  });
  wrapper.unmount();
  const restored = mountTable({ active: persisted[0].id });
  await flushPromises();
  expect(search(restored).element).toHaveProperty("value", "Beta");
  expect(restored.get("tbody").text()).toContain("Beta");
  await openMenu(restored);
  await choose("Delete view");
  expect(current(restored).text()).toBe("Default view");
  expect(
    JSON.parse(localStorage.getItem("yayaw-table:view-test:views") ?? "[]")
  ).toEqual([]);
});

it("keeps failed creation drafts, validates names, and sends the complete action context", async () => {
  const create = vi.fn(() =>
    Promise.resolve<TableViewActionResult>({
      success: false,
      error: "Name already used",
    })
  );
  const wrapper = mountTable({ actions: { create } });
  await flushPromises();
  await openSave(wrapper);
  await submit();
  expect(create).not.toHaveBeenCalled();
  expect(body().get('.yayaw-view-form [role="alert"]').text()).toContain(
    "Enter a view name"
  );
  await setName("  My draft  ");
  await submit();
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      tableId: config.id,
      tableType: "products",
      name: "My draft",
      isGlobal: false,
    })
  );
  expect(body().get('.yayaw-view-form [role="alert"]').text()).toBe(
    "Name already used"
  );
  expect(body().get(".yayaw-view-form input").element).toHaveProperty(
    "value",
    "  My draft  "
  );
  expect(
    body().get('button[type="submit"]').attributes("disabled")
  ).toBeUndefined();
});

it("keeps later edits dirty while an update is pending and sends a detached snapshot", async () => {
  const pending = deferred<TableViewActionResult>();
  const update = vi.fn<NonNullable<TableViewActions["update"]>>(
    () => pending.promise
  );
  const wrapper = mountTable({
    views: [saved],
    active: saved.id,
    actions: { update },
  });
  await flushPromises();
  await search(wrapper).setValue("First draft");
  await (await saveButton(wrapper)).trigger("click");
  expect(update).toHaveBeenCalledWith(
    "mine",
    expect.objectContaining({
      tableId: config.id,
      tableType: "products",
      name: "My view",
      config: expect.objectContaining({ globalSearch: "First draft" }),
    })
  );
  expect(current(wrapper).attributes("disabled")).toBeDefined();
  await search(wrapper).setValue("Later draft");
  const sent = update.mock.calls[0]?.[1] as unknown as {
    config: TableView["config"];
  };
  pending.resolve({ success: true, data: { ...saved, config: sent.config } });
  await flushPromises();
  expect(search(wrapper).element).toHaveProperty("value", "Later draft");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
});

it("preserves explicit URL state and uses the saved configuration to detect unsaved changes", async () => {
  window.history.replaceState(
    {},
    "",
    "/?view=mine&view-test-q=Beta&view-test-display=gallery"
  );
  const wrapper = mountTable({ views: [saved], syncUrl: true });
  await flushPromises();
  expect(current(wrapper).text()).toBe("My view");
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
  expect(wrapper.find(".yayaw-gallery").exists()).toBe(true);
  window.history.replaceState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await flushPromises();
  expect(current(wrapper).text()).toBe("Default view");
  expect(wrapper.find(".yayaw-gallery").exists()).toBe(false);
});

it("restores a view-only URL, ignores URL state when disabled, and protects system views", async () => {
  window.history.replaceState({}, "", "/?view=mine");
  const wrapper = mountTable({ views: [saved], syncUrl: true });
  await flushPromises();
  expect(search(wrapper).element).toHaveProperty("value", "Alpha");
  wrapper.unmount();
  const system = mountTable({
    views: [{ ...saved, id: "system", isSystem: true, isDefault: true }],
  });
  await flushPromises();
  expect(current(system).text()).toBe("My view");
  await search(system).setValue("Changed");
  expect(system.find('[aria-label="Save changes"]').exists()).toBe(false);
  await openMenu(system);
  expect(
    body()
      .findAll(".yayaw-view-menu-item")
      .some((item) => item.text() === "Delete view")
  ).toBe(false);
});

it("does not overwrite user edits when a default view arrives late, and retries list failures", async () => {
  const pending = deferred<TableView[]>();
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockReturnValueOnce(pending.promise);
  const wrapper = mountTable({ actions: { list } });
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("Offline");
  await wrapper.get(".yayaw-view-error button").trigger("click");
  await flushPromises();
  await search(wrapper).setValue("Draft while loading");
  pending.resolve([{ ...saved, isDefault: true }]);
  await flushPromises();
  expect(search(wrapper).element).toHaveProperty(
    "value",
    "Draft while loading"
  );
  expect(current(wrapper).text()).toBe("Default view");
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
});

it("uses persisted records over initial seeds and supports French and React translation keys", async () => {
  const wrapper = mountTable({
    views: [saved],
    active: "mine",
    locale: "fr",
    translations: { "views.saveAs": "Créer une vue" },
    actions: {
      list: () => [
        { ...saved, name: "Vue mise à jour", config: { globalSearch: "Beta" } },
      ],
    },
  });
  await flushPromises();
  expect(current(wrapper).text()).toBe("Vue mise à jour");
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  await openViewMenu(wrapper);
  await wrapper.get('[aria-label="Créer une vue"]').trigger("click");
  await flushPromises();
  expect(body().get('[role="dialog"]').text()).toContain("Nom de la vue");
});

it("hides write actions when view saving is disabled", async () => {
  const wrapper = mountTable({
    views: [saved],
    table: { allowViewSave: false },
  });
  await flushPromises();
  expect(wrapper.find('[aria-label="Add view"]').exists()).toBe(false);
  await openMenu(wrapper);
  expect(
    body()
      .findAll(".yayaw-view-menu-item")
      .map((item) => item.text())
  ).toEqual(["Default view", "My view", "Favorite view", "Reset view"]);
});

it("recovers from update and delete failures and applies server-normalized configurations", async () => {
  const update = vi
    .fn<NonNullable<TableViewActions["update"]>>()
    .mockRejectedValueOnce(new Error("Update refused"))
    .mockResolvedValueOnce({
      success: true,
      data: { ...saved, config: { globalSearch: "Beta" } },
    });
  const remove = vi
    .fn<NonNullable<TableViewActions["delete"]>>()
    .mockResolvedValueOnce({ success: false, error: "Delete refused" })
    .mockResolvedValueOnce({ success: true });
  const wrapper = mountTable({
    views: [saved],
    active: saved.id,
    actions: { update, delete: remove },
  });
  await flushPromises();
  await search(wrapper).setValue("Draft");
  await (await saveButton(wrapper)).trigger("click");
  await flushPromises();
  expect(wrapper.get('.yayaw-view-manager [role="alert"]').text()).toBe(
    "Update refused"
  );
  expect(search(wrapper).element).toHaveProperty("value", "Draft");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
  await (await saveButton(wrapper)).trigger("click");
  await flushPromises();
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  await openMenu(wrapper);
  await choose("Delete view");
  expect(wrapper.get('.yayaw-view-manager [role="alert"]').text()).toBe(
    "Delete refused"
  );
  expect(current(wrapper).text()).toBe("My view");
  await openMenu(wrapper);
  await choose("Delete view");
  expect(remove).toHaveBeenLastCalledWith("mine", {
    tableId: config.id,
    tableType: "products",
  });
  expect(current(wrapper).text()).toBe("Default view");
});

it("does not derive table grouping from a legacy saved Kanban lane or URL", async () => {
  const legacy = {
    ...saved,
    config: { displayMode: "table" as const, kanban: { groupBy: "status" } },
  };
  const wrapper = mountTable({ views: [legacy], active: legacy.id });
  await flushPromises();
  expect(wrapper.get("tbody").text()).toContain("Alpha");
  wrapper.unmount();
  const params = new URLSearchParams({
    view: "mine",
    "view-test-kanban": JSON.stringify({ groupBy: "status" }),
  });
  window.history.replaceState({}, "", `/?${params}`);
  const fromUrl = mountTable({ views: [legacy], syncUrl: true });
  await flushPromises();
  expect(fromUrl.get("tbody").text()).toContain("Alpha");
});

it("explains a clean saved view on keyboard focus without a native duplicate", async () => {
  const wrapper = mountTable({
    locale: "fr",
    views: [saved],
    active: saved.id,
  });
  await openViewMenu(wrapper);
  const trigger = wrapper.get('[aria-label="Enregistrer les modifications"]');
  expect(trigger.attributes("title")).toBeUndefined();
  expect(trigger.attributes("aria-disabled")).toBe("true");
  (trigger.element as HTMLButtonElement).focus();
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(body().get('[role="tooltip"]').text()).toBe(
    "Cette vue est déjà à jour"
  );
});

it("tracks density-only changes and restores a saved density or legacy default", async () => {
  const wrapper = mountTable({
    views: [
      saved,
      {
        ...saved,
        id: "compact",
        name: "Compact",
        config: { density: "extra-small" },
      },
    ],
    active: saved.id,
    table: { density: "large" },
  });
  await flushPromises();
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  await openViewMenu(wrapper);
  await flushPromises();
  await body()
    .findAll(".yayaw-density-inline button")
    .find((item) => item.text() === "XS")
    ?.trigger("click");
  await flushPromises();
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
  await openMenu(wrapper);
  await choose("Compact");
  expect(wrapper.attributes("data-density") === "extra-small").toBe(true);
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  await openMenu(wrapper);
  await choose("My view");
  expect(wrapper.attributes("data-density") === "large").toBe(true);
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
});

it("loads persisted default views without initialViews again after remount", async () => {
  const view: TableView = {
    ...saved,
    name: "Persisted compact view",
    isDefault: true,
    config: { density: "extra-small" },
  };
  const list = vi.fn(async () => ({ data: [view] }));
  for (let mountIndex = 0; mountIndex < 2; mountIndex++) {
    const wrapper = mountTable({
      actions: { list },
      table: { density: "large" },
    });
    await flushPromises();
    expect(current(wrapper).text()).toBe(view.name);
    expect(wrapper.attributes("data-density") === "extra-small").toBe(true);
    wrapper.unmount();
  }
  expect(list).toHaveBeenCalledTimes(2);
});

it("favorites a shared system view independently of write permissions, restores it, and clears it", async () => {
  const shared = { ...saved, isGlobal: true, isSystem: true };
  const options = { views: [shared], table: { allowViewSave: false } };
  const wrapper = mountTable({ ...options, active: shared.id });
  await flushPromises();
  await search(wrapper).setValue("Beta");
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(
    (
      await favoriteAction(wrapper, '[aria-label="Remove favorite view"]')
    ).attributes("aria-pressed")
  ).toBe("true");
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  expect(shared.isDefault).toBeUndefined();
  wrapper.unmount();
  const reloaded = mountTable(options);
  await flushPromises();
  expect(current(reloaded).text()).toBe(shared.name);
  expect(search(reloaded).element).toHaveProperty("value", "Alpha");
  await (
    await favoriteAction(reloaded, '[aria-label="Remove favorite view"]')
  ).trigger("click");
  await flushPromises();
  reloaded.unmount();
  const cleared = mountTable(options);
  await flushPromises();
  expect(current(cleared).text()).toBe("Default view");
});

it("loads a remote favorite before the shared default and replaces it without updating view records", async () => {
  const setFavorite = vi.fn(async (viewId: string | null) => ({
    success: true,
    data: { viewId },
  }));
  const update = vi.fn();
  const standard = {
    ...saved,
    id: "default",
    name: "Team default",
    isDefault: true,
  };
  const wrapper = mountTable({
    views: [standard, saved],
    actions: {
      getFavorite: () => ({ data: { viewId: saved.id } }),
      setFavorite,
      update,
    },
  });
  await flushPromises();
  expect(current(wrapper).text()).toBe(saved.name);
  await openMenu(wrapper);
  await choose(standard.name);
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(setFavorite).toHaveBeenCalledWith(standard.id, {
    tableId: config.id,
    tableType: "products",
  });
  expect(update).not.toHaveBeenCalled();
  expect(
    (
      await favoriteAction(wrapper, '[aria-label="Remove favorite view"]')
    ).attributes("aria-pressed")
  ).toBe("true");
});

it("ignores an inaccessible favorite and respects an explicit initial view", async () => {
  const standard = {
    ...saved,
    id: "default",
    name: "Team default",
    isDefault: true,
  };
  const actions = { getFavorite: () => ({ data: { viewId: "removed" } }) };
  const wrapper = mountTable({ views: [standard, saved], actions });
  await flushPromises();
  expect(current(wrapper).text()).toBe(standard.name);
  wrapper.unmount();
  const explicit = mountTable({
    views: [standard, saved],
    active: standard.id,
    actions: {
      getFavorite: () => ({ data: { viewId: saved.id } }),
    },
  });
  await flushPromises();
  expect(current(explicit).text()).toBe(standard.name);
});

it("does not replace edits while the favorite loads, or after choosing the default view", async () => {
  const pending = deferred<TableViewActionResult<{ viewId: string | null }>>();
  const wrapper = mountTable({
    views: [saved],
    actions: { getFavorite: () => pending.promise },
  });
  await flushPromises();
  await search(wrapper).setValue("Beta");
  pending.resolve({ data: { viewId: saved.id } });
  await flushPromises();
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  expect(current(wrapper).text()).toBe("Default view");
  await openMenu(wrapper);
  await choose(saved.name);
  await openMenu(wrapper);
  await choose("Default view");
  expect(search(wrapper).element).toHaveProperty("value", "");
});

it("exposes failed favorite writes and allows retry without changing the current view", async () => {
  const setFavorite = vi
    .fn()
    .mockResolvedValueOnce({ success: false, error: "Preference unavailable" })
    .mockResolvedValueOnce({ success: true, data: { viewId: saved.id } });
  const wrapper = mountTable({
    views: [saved],
    active: saved.id,
    actions: { setFavorite },
  });
  await flushPromises();
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe("Preference unavailable");
  expect(
    (
      await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
    ).attributes("aria-pressed")
  ).toBe("false");
  expect(search(wrapper).element).toHaveProperty("value", "Alpha");
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(
    (
      await favoriteAction(wrapper, '[aria-label="Remove favorite view"]')
    ).attributes("aria-pressed")
  ).toBe("true");
});

it("favorites the built-in default by clearing the preference, preserves drafts, and restores its star", async () => {
  let favoriteId: string | null = saved.id;
  const setFavorite = vi.fn((viewId: string | null) => {
    favoriteId = viewId;
    return { success: true, data: { viewId } };
  });
  const options = {
    views: [saved],
    table: { allowViewSave: false },
    actions: {
      getFavorite: () => ({ data: { viewId: favoriteId } }),
      setFavorite,
    },
  };
  const wrapper = mountTable(options);
  await flushPromises();
  await openMenu(wrapper);
  await choose("Default view");
  await search(wrapper).setValue("Beta");
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(setFavorite).toHaveBeenCalledWith(null, {
    tableId: config.id,
    tableType: "products",
  });
  expect(
    (await favoriteAction(wrapper, '[aria-label="Favorite view"]')).attributes(
      "aria-pressed"
    )
  ).toBe("true");
  expect(search(wrapper).element).toHaveProperty("value", "Beta");
  await (await favoriteAction(wrapper, '[aria-label="Favorite view"]')).trigger(
    "click"
  );
  await flushPromises();
  expect(setFavorite).toHaveBeenCalledTimes(1);
  wrapper.unmount();
  const reloaded = mountTable(options);
  await flushPromises();
  expect(current(reloaded).text()).toBe("Default view");
  expect(
    (await favoriteAction(reloaded, '[aria-label="Favorite view"]')).attributes(
      "aria-pressed"
    )
  ).toBe("true");
  await openMenu(reloaded);
  const row = body()
    .findAll(".yayaw-view-menu-item")
    .find((item) => item.text() === "Default view");
  expect(row?.find('[role="img"][aria-label="Favorite view"]').exists()).toBe(
    true
  );
});

it("keeps the old favorite if clearing it fails and retries from the default view", async () => {
  const setFavorite = vi
    .fn()
    .mockResolvedValueOnce({ success: false, error: "Offline" })
    .mockResolvedValueOnce({ success: true, data: { viewId: null } });
  const wrapper = mountTable({
    views: [saved],
    actions: {
      getFavorite: () => ({ data: { viewId: saved.id } }),
      setFavorite,
    },
  });
  await flushPromises();
  await openMenu(wrapper);
  await choose("Default view");
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
  expect(
    (
      await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
    ).attributes("aria-pressed")
  ).toBe("false");
  await (
    await favoriteAction(wrapper, '[aria-label="Use this view on arrival"]')
  ).trigger("click");
  await flushPromises();
  expect(
    (await favoriteAction(wrapper, '[aria-label="Favorite view"]')).attributes(
      "aria-pressed"
    )
  ).toBe("true");
});

it("compares legacy footer visibility and restores it without persisting the draft", async () => {
  const update = vi.fn();
  const wrapper = mountTable({
    views: [saved],
    active: saved.id,
    table: { enableCalculations: true },
    actions: { update },
  });
  await flushPromises();
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  const calculations = wrapper.get('[role="switch"]');
  expect(calculations.attributes("aria-checked")).toBe("true");
  await calculations.trigger("click");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("false");
  await wrapper.get('[aria-label="Reset view"]').trigger("click");
  await flushPromises();
  expect(calculations.attributes("aria-checked")).toBe("true");
  expect((await saveButton(wrapper)).attributes("aria-disabled")).toBe("true");
  expect(update).not.toHaveBeenCalled();
});
