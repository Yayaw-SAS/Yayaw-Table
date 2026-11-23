import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { computed, h, ref } from "vue";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import { createTranslations } from "../../translations";
import type { ColumnDefinition, TableRecord } from "../../types";
import CellRenderer from "./CellRenderer.vue";

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
});

const Icon = { render: () => h("svg", { "data-icon": "" }) };

const mountCell = (
  column: ColumnDefinition,
  row: TableRecord,
  value: unknown
) => {
  const context = {
    config: defineTableConfig({
      id: "tag-items",
      columns: { definitions: [column], mandatory: [], visible: [], order: [] },
      translations: { namespace: "items", keys: {} },
      table: {},
    }),
    tableType: "items",
    actions: computed(() => ({})),
    translations: computed(() => createTranslations("en")),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
    status: ref(null),
  } as unknown as TableContextValue;
  const parentClick = vi.fn();
  const wrapper = mount(
    {
      render: () =>
        h(
          "div",
          {
            onClick: parentClick,
            onDblclick: parentClick,
            onPointerdown: parentClick,
            onKeydown: parentClick,
            onContextmenu: parentClick,
            onDragstart: parentClick,
          },
          [h(CellRenderer, { column, row, value })]
        ),
    },
    {
      attachTo: document.body,
      global: {
        provide: { [tableContextKey as symbol]: context },
        stubs: {
          PopperArrow: true,
          PopperContent: { template: "<div><slot /></div>" },
        },
      },
    }
  );
  mounted.push(wrapper);
  return { wrapper, parentClick };
};

const row = {
  id: "7",
  activations: [
    { id: 1, name: "Reel 1", posts: 2 },
    { id: 2, name: "Story", posts: 0 },
  ],
};

it("draws each tag from the row's tagItem and keeps tag clicks off the row", async () => {
  const onTagClick = vi.fn();
  const { wrapper, parentClick } = mountCell(
    {
      id: "activations",
      header: "Activations",
      type: "tag",
      tagItem: (value) => {
        const activation = value as (typeof row.activations)[number];
        return {
          label: activation.name,
          tone: activation.posts > 0 ? "success" : "neutral",
          icon: Icon,
          title: `Activation #${activation.id}`,
        };
      },
      onTagClick,
    },
    row,
    row.activations
  );

  const tags = wrapper.findAll<HTMLElement>(".yayaw-tag");
  expect(tags.map((tag) => tag.text())).toEqual(["Reel 1", "Story"]);
  expect(tags.map((tag) => tag.element.tagName)).toEqual(["BUTTON", "BUTTON"]);
  expect(tags.map((tag) => tag.attributes("type"))).toEqual([
    "button",
    "button",
  ]);
  expect(tags.map((tag) => tag.attributes("title"))).toEqual([
    "Activation #1",
    "Activation #2",
  ]);
  expect(tags.map((tag) => tag.attributes("data-colored"))).toEqual([
    "true",
    "false",
  ]);
  expect(tags[0]?.element.style.getPropertyValue("--yayaw-tag-color")).toBe(
    "var(--yayaw-success, #16a34a)"
  );
  expect(tags.every((tag) => tag.find("[data-icon]").exists())).toBe(true);

  await tags[1]?.trigger("click");
  expect(onTagClick).toHaveBeenCalledWith(row.activations[1], row);
  expect(parentClick).not.toHaveBeenCalled();
});

const body = () => new DOMWrapper(document.body);
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

it("opens tag actions on click, hides unavailable actions, skips disabled actions and groups destructive ones last", async () => {
  const onSelect = vi.fn();
  const visible = vi.fn((value) => value === row.activations[0]);
  const disabled = vi.fn(() => true);
  const { wrapper, parentClick } = mountCell(
    {
      id: "activations",
      header: "Activations",
      type: "tag",
      tagItem: (value) => ({
        label: (value as { name: string }).name,
        title: "Activation",
        tone: "success",
        icon: Icon,
      }),
      tagActions: [
        { id: "delete", label: "Delete", onSelect, destructive: true },
        { id: "edit", label: "Edit", icon: Icon, onSelect, visible },
        { id: "disabled", label: "Unavailable", onSelect, disabled },
        { id: "hidden", label: "Hidden", onSelect, visible: () => false },
      ],
    },
    row,
    row.activations
  );
  const tag = wrapper.get(".yayaw-tag");
  expect(tag.element.tagName).toBe("BUTTON");
  expect(tag.attributes("title")).toBe("Activation");
  expect(tag.attributes("data-colored")).toBe("true");
  expect(tag.find("[data-icon]").exists()).toBe(true);
  expect(tag.attributes("aria-haspopup")).toBe("menu");
  await tag.trigger("click");
  await settle();
  const menu = body().get('[role="menu"]');
  expect(menu.attributes("id")).toBe(tag.attributes("aria-controls"));
  expect(menu.attributes("aria-labelledby")).toBe(tag.attributes("id"));
  const items = menu.findAll('[role="menuitem"]');
  expect(items.map((item) => item.text())).toEqual([
    "Edit",
    "Unavailable",
    "Delete",
  ]);
  expect(items[0]?.find("[data-icon]").exists()).toBe(true);
  expect(items[1]?.attributes("aria-disabled")).toBe("true");
  expect(items[2]?.classes()).toContain("yayaw-row-action-danger");
  expect(menu.get('[role="separator"]').element.nextElementSibling).toBe(
    items[2]?.element
  );
  await items[1]?.trigger("click");
  expect(onSelect).not.toHaveBeenCalled();
  expect(body().find('[role="menu"]').exists()).toBe(true);
  await items[0]?.trigger("click");
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(row.activations[0], row);
  expect(visible).toHaveBeenCalledWith(row.activations[0], row);
  expect(disabled).toHaveBeenCalledWith(row.activations[0], row);
  expect(body().find('[role="menu"]').exists()).toBe(false);
  expect(parentClick).not.toHaveBeenCalled();
});

it("opens the tag's menu on right click and keeps activation, drag and context events off the row", async () => {
  const onSelect = vi.fn();
  const { wrapper, parentClick } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "select",
      tagActions: [{ id: "view", label: "View", onSelect }],
    },
    row,
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  for (const type of ["pointerdown", "dblclick", "dragstart"]) {
    await tag.trigger(type);
  }
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
  });
  tag.element.dispatchEvent(event);
  await settle();
  expect(event.defaultPrevented).toBe(true);
  await body().get('[role="menuitem"]').trigger("click");
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("done", row);
  expect(parentClick).not.toHaveBeenCalled();
});

it.each([
  { key: "Enter" },
  { key: " " },
  { key: "ContextMenu" },
  { key: "F10", shiftKey: true },
])("opens with $key, focuses an enabled item and restores the tag on Escape", async (keyboard) => {
  const { wrapper, parentClick } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      tagActions: [
        {
          id: "blocked",
          label: "Blocked",
          disabled: () => true,
          onSelect: vi.fn(),
        },
        { id: "view", label: "View", onSelect: vi.fn() },
      ],
    },
    row,
    "done"
  );
  const tag = wrapper.get<HTMLElement>(".yayaw-tag");
  await settle();
  tag.element.focus();
  await tag.trigger("keydown", keyboard);
  await settle();
  expect(document.activeElement?.textContent).toBe("View");
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    { key: "Escape" }
  );
  await settle();
  expect(body().find('[role="menu"]').exists()).toBe(false);
  expect(document.activeElement).toBe(tag.element);
  expect(parentClick).not.toHaveBeenCalled();
});

it("preserves onTagClick activation and exposes contextual actions without stealing the callback's focus", async () => {
  const onTagClick = vi.fn();
  const destination = document.createElement("button");
  destination.textContent = "Dialog action";
  const onSelect = vi.fn(() => {
    document.body.append(destination);
    destination.focus();
  });
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      onTagClick,
      tagActions: [{ id: "view", label: "View", onSelect }],
    },
    row,
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  await tag.trigger("click");
  expect(onTagClick).toHaveBeenCalledExactlyOnceWith("done", row);
  expect(body().find('[role="menu"]').exists()).toBe(false);
  for (const key of ["Enter", " "]) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    tag.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  await tag.trigger("keydown", { key: "F10", shiftKey: true });
  await settle();
  await body().get('[role="menuitem"]').trigger("keydown", { key: "Enter" });
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("done", row);
  expect(onTagClick).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(destination);
});

it("keeps the historical plain tag when no actions are visible", async () => {
  const { wrapper, parentClick } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      tagActions: [
        {
          id: "hidden",
          label: "Hidden",
          visible: () => false,
          onSelect: vi.fn(),
        },
      ],
    },
    row,
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  expect(tag.element.tagName).toBe("SPAN");
  expect(tag.attributes("aria-haspopup")).toBeUndefined();
  await tag.trigger("click");
  expect(parentClick).toHaveBeenCalledTimes(1);
  expect(body().find('[role="menu"]').exists()).toBe(false);
});

it("closes when the last action becomes hidden without reopening when it returns", async () => {
  const visible = ref(true);
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      tagActions: [
        {
          id: "view",
          label: "View",
          visible: () => visible.value,
          onSelect: vi.fn(),
        },
      ],
    },
    row,
    "done"
  );
  await wrapper.get(".yayaw-tag").trigger("click");
  await settle();
  expect(body().find('[role="menu"]').exists()).toBe(true);
  visible.value = false;
  await settle();
  expect(wrapper.get(".yayaw-tag").element.tagName).toBe("SPAN");
  expect(body().find('[role="menu"]').exists()).toBe(false);
  visible.value = true;
  await settle();
  expect(wrapper.get(".yayaw-tag").attributes("aria-expanded")).toBe("false");
  expect(body().find('[role="menu"]').exists()).toBe(false);
});

it("places the portal above the tag's nested overlay layers", async () => {
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      tagActions: [{ id: "view", label: "View", onSelect: vi.fn() }],
    },
    row,
    "done"
  );
  const outer = document.createElement("div");
  outer.style.cssText = "position:fixed;z-index:400";
  document.body.append(outer);
  outer.append(wrapper.element);
  (wrapper.element as HTMLElement).style.cssText = "position:fixed;z-index:600";
  await wrapper.get(".yayaw-tag").trigger("click");
  await settle();
  expect(body().get<HTMLElement>('[role="menu"]').element.style.zIndex).toBe(
    "601"
  );
  expect(outer.querySelector('[role="menu"]')).toBeNull();
});

it("keeps a native dialog's menu in its top layer", async () => {
  const onSelect = vi.fn();
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      tagActions: [{ id: "view", label: "View", onSelect }],
    },
    row,
    "done"
  );
  const dialog = document.createElement("dialog");
  dialog.open = true;
  document.body.append(dialog);
  dialog.append(wrapper.element);
  const tag = wrapper.get<HTMLElement>(".yayaw-tag");
  await tag.trigger("click");
  await settle();
  expect(dialog.querySelector('[role="menu"]')).not.toBeNull();
  await body().get('[role="menuitem"]').trigger("click");
  await settle();
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("done", row);
  expect(document.activeElement).toBe(tag.element);
  expect(dialog.open).toBe(true);
});

it("opens on a stationary touch hold, cancels on movement and ignores its synthetic click", async () => {
  vi.useFakeTimers();
  const onTagClick = vi.fn();
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      onTagClick,
      tagActions: [{ id: "view", label: "View", onSelect: vi.fn() }],
    },
    row,
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  await tag.trigger("pointerdown", {
    pointerType: "touch",
    clientX: 10,
    clientY: 10,
  });
  await tag.trigger("pointermove", {
    pointerType: "touch",
    clientX: 40,
    clientY: 10,
  });
  await vi.advanceTimersByTimeAsync(500);
  expect(body().find('[role="menu"]').exists()).toBe(false);
  await tag.trigger("pointerdown", {
    pointerType: "touch",
    clientX: 10,
    clientY: 10,
  });
  await vi.advanceTimersByTimeAsync(500);
  vi.useRealTimers();
  await settle();
  expect(body().find('[role="menu"]').exists()).toBe(true);
  await tag.trigger("pointerup");
  await tag.trigger("click");
  expect(onTagClick).not.toHaveBeenCalled();
  expect(body().find('[role="menu"]').exists()).toBe(true);
});

it("keeps option tags as plain labels without tagItem or onTagClick", () => {
  const { wrapper } = mountCell(
    {
      id: "status",
      header: "Status",
      type: "tag",
      options: [{ value: "done", label: "Done", color: "green" }],
    },
    { id: "1" },
    "done"
  );
  const tag = wrapper.get(".yayaw-tag");
  expect(tag.element.tagName).toBe("SPAN");
  expect(tag.text()).toBe("Done");
  expect(tag.attributes("data-tag-button")).toBeUndefined();
});
