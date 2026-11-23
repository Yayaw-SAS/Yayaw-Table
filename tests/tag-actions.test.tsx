import "./setup-dom";
import { afterEach, expect, it, spyOn } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, createRef, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../src/components/ui/dialog";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import { DrawerFormPortalContainerContext } from "../src/components/ui/yayaw-table/components/forms/drawer-form-portal-context";
import type { ColumnDefinition } from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const value = { id: 2, name: "Reel", posts: 3 };
const row = { id: "7", activations: [value] };
const pause = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
async function renderTag(
  column: Partial<ColumnDefinition>,
  wrap = (child: ReactNode) => child
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="tag-actions"
        translations={defaultTranslations}
      >
        {wrap(
          <DataTypeCell
            column={{
              id: "activations",
              header: "Activations",
              type: "tag",
              tagItem: () => ({
                label: "Reel",
                tone: "success",
                title: "3 posts",
                icon: <svg data-tag-icon="" />,
              }),
              ...column,
            }}
            row={row}
            value={row.activations}
          />
        )}
      </TableProvider>
    );
    await pause();
  });
  return [...document.querySelectorAll<HTMLElement>(".yayaw-tag")].at(
    -1
  ) as HTMLElement;
}
async function dispatch(target: HTMLElement, event: Event) {
  await act(async () => {
    target.dispatchEvent(event);
    await pause();
  });
}
async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await pause();
  });
}
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
const items = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
];

it("opens per-tag actions by click and right-click, preserving appearance, visibility, disabling and group order", async () => {
  const selected: unknown[] = [];
  const checks: unknown[] = [];
  const tag = await renderTag({
    tagActions: [
      {
        id: "delete",
        label: "Delete",
        destructive: true,
        onSelect: (...args) => selected.push(args),
      },
      {
        id: "open",
        label: "Open",
        icon: <svg data-action-icon="" />,
        onSelect: (...args) => selected.push(args),
      },
      {
        id: "hidden",
        label: "Hidden",
        visible: (...args) => {
          checks.push(args);
          return false;
        },
        onSelect: () => selected.push("hidden"),
      },
      {
        id: "locked",
        label: "Locked",
        disabled: (...args) => {
          checks.push(args);
          return true;
        },
        onSelect: () => selected.push("locked"),
      },
    ],
  });
  expect(tag.tagName).toBe("BUTTON");
  expect(tag.title).toBe("3 posts");
  expect(tag.style.getPropertyValue("--yayaw-tag-color")).toBe(
    "var(--yayaw-success, #16a34a)"
  );
  expect(Boolean(tag.querySelector("[data-tag-icon]"))).toBe(true);
  expect(
    checks.every(
      (args) =>
        (args as unknown[])[0] === value && (args as unknown[])[1] === row
    )
  ).toBe(true);
  await click(tag);
  expect(items().map((item) => item.textContent)).toEqual([
    "Open",
    "Locked",
    "Delete",
  ]);
  expect(Boolean(items()[0]?.querySelector("[data-action-icon]"))).toBe(true);
  expect(items()[1]?.getAttribute("aria-disabled")).toBe("true");
  expect(items()[2]?.dataset.variant).toBe("destructive");
  expect(menu()?.querySelectorAll('[role="separator"]').length).toBe(1);
  await click(items()[1] as HTMLElement);
  expect(selected).toEqual([]);
  await click(items()[0] as HTMLElement);
  expect(selected).toEqual([[value, row]]);
  expect(Boolean(menu())).toBe(false);
  expect(document.activeElement === tag).toBe(true);
  const context = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
  });
  await dispatch(tag, context);
  expect(context.defaultPrevented).toBe(true);
  expect(items().map((item) => item.textContent)).toEqual([
    "Open",
    "Locked",
    "Delete",
  ]);
});

it("keeps a primary tag click while exposing the menu by contextual keyboard shortcuts", async () => {
  const clicks: unknown[] = [];
  const selected: unknown[] = [];
  const tag = await renderTag({
    onTagClick: (...args) => clicks.push(args),
    tagActions: [
      { id: "edit", label: "Edit", onSelect: (...args) => selected.push(args) },
    ],
  });
  await click(tag);
  expect(clicks).toEqual([[value, row]]);
  expect(Boolean(menu())).toBe(false);
  for (const key of ["Enter", " "]) {
    await dispatch(
      tag,
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  }
  expect(clicks.length).toBe(3);
  expect(Boolean(menu())).toBe(false);
  for (const event of [
    new KeyboardEvent("keydown", {
      key: "ContextMenu",
      bubbles: true,
      cancelable: true,
    }),
    new KeyboardEvent("keydown", {
      key: "F10",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  ]) {
    await dispatch(tag, event);
    expect(Boolean(menu())).toBe(true);
    await click(items()[0] as HTMLElement);
  }
  expect(clicks.length).toBe(3);
  expect(selected).toEqual([
    [value, row],
    [value, row],
  ]);
});

it("opens the menu with Enter and Space and isolates both tag and portalled menu events", async () => {
  const bubbled: string[] = [];
  const record = (event: { type: string }) => bubbled.push(event.type);
  const tag = await renderTag(
    { tagActions: [{ id: "open", label: "Open", onSelect: () => undefined }] },
    (child) => (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/noStaticElementInteractions: This test boundary records bubbling without nesting interactive controls.
      <div
        onClick={record}
        onContextMenu={record}
        onDoubleClick={record}
        onDragStart={record}
        onKeyDown={record}
        onKeyUp={record}
        onMouseDown={record}
        onMouseUp={record}
        onPointerDown={record}
        onPointerUp={record}
      >
        {child}
      </div>
    )
  );
  for (const key of ["Enter", " "]) {
    await dispatch(
      tag,
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
    expect(Boolean(menu())).toBe(true);
    await dispatch(
      items()[0] as HTMLElement,
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(Boolean(menu())).toBe(false);
  }
  await click(tag);
  for (const target of [tag, items()[0] as HTMLElement]) {
    for (const type of [
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "dblclick",
      "dragstart",
    ]) {
      await dispatch(
        target,
        new MouseEvent(type, { bubbles: true, cancelable: true })
      );
    }
  }
  await click(items()[0] as HTMLElement);
  expect(bubbled).toEqual([]);
});

it("keeps historical behavior when every action is hidden", async () => {
  const hidden = [
    {
      id: "hidden",
      label: "Hidden",
      visible: () => false,
      onSelect: () => undefined,
    },
  ];
  const plain = await renderTag({ tagActions: hidden });
  expect(plain.tagName).toBe("SPAN");
  expect(plain.hasAttribute("aria-haspopup")).toBe(false);
  let clicks = 0;
  const primary = await renderTag({
    onTagClick: () => clicks++,
    tagActions: hidden,
  });
  await click(primary);
  expect(clicks).toBe(1);
  expect(Boolean(menu())).toBe(false);
});

it("reports a rejected action without leaving the menu open or losing trigger focus", async () => {
  const errorToast = spyOn(toast, "error").mockImplementation(() => 0);
  try {
    const tag = await renderTag({
      tagActions: [
        {
          id: "save",
          label: "Save",
          onSelect: () => Promise.reject(new Error("Could not save tag")),
        },
      ],
    });
    await click(tag);
    await click(items()[0] as HTMLElement);
    expect(errorToast).toHaveBeenCalledWith("Could not save tag");
    expect(Boolean(menu())).toBe(false);
    expect(document.activeElement === tag).toBe(true);
  } finally {
    errorToast.mockRestore();
  }
});

it("ignores a drawer portal context inherited by a dialog outside that drawer", async () => {
  const drawer = document.createElement("div");
  drawer.style.zIndex = "9000";
  document.body.append(drawer);
  const tag = await renderTag(
    { tagActions: [{ id: "open", label: "Open", onSelect: () => undefined }] },
    (child) => (
      <DrawerFormPortalContainerContext.Provider value={{ current: drawer }}>
        <Dialog defaultOpen>
          <DialogContent style={{ zIndex: 7000 }}>
            <DialogTitle>Nested record</DialogTitle>
            {child}
          </DialogContent>
        </Dialog>
      </DrawerFormPortalContainerContext.Provider>
    )
  );
  await click(tag);
  expect(Boolean(menu())).toBe(true);
  expect(drawer.contains(menu())).toBe(false);
  expect(Number(menu()?.parentElement?.style.zIndex)).toBe(7001);
  await click(items()[0] as HTMLElement);
  expect(document.activeElement === tag).toBe(true);
});

it("keeps a native dialog's menu in the top layer ahead of its containing drawer context", async () => {
  const drawer = createRef<HTMLDivElement>();
  const tag = await renderTag(
    { tagActions: [{ id: "open", label: "Open", onSelect: () => undefined }] },
    (child) => (
      <DrawerFormPortalContainerContext.Provider value={drawer}>
        <div ref={drawer}>
          <dialog aria-label="Native record" open>
            {child}
          </dialog>
        </div>
      </DrawerFormPortalContainerContext.Provider>
    )
  );
  expect(drawer.current?.contains(tag)).toBe(true);
  await click(tag);
  expect(Boolean(menu())).toBe(true);
  expect(tag.closest("dialog")?.contains(menu())).toBe(true);
  const escapeKey = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  await dispatch(items()[0] as HTMLElement, escapeKey);
  expect(escapeKey.defaultPrevented).toBe(true);
  expect(Boolean(menu())).toBe(false);
  expect(tag.closest("dialog")?.open).toBe(true);
  expect(document.activeElement === tag).toBe(true);
  await click(tag);
  const triggerEscape = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  await dispatch(tag, triggerEscape);
  expect(triggerEscape.defaultPrevented).toBe(true);
  expect(Boolean(menu())).toBe(false);
  expect(tag.closest("dialog")?.open).toBe(true);
});

it("closes only the menu on Escape and leaves focus in a dialog opened by an action", async () => {
  let parentClosed = false;
  function Example() {
    const [childOpen, setChildOpen] = useState(false);
    return (
      <TableProvider
        queryClient={new QueryClient()}
        tableId="tag-dialogs"
        translations={defaultTranslations}
      >
        <Dialog
          defaultOpen
          onOpenChange={(open) => {
            parentClosed = !open;
          }}
        >
          <DialogContent style={{ zIndex: 7000, overflow: "hidden" }}>
            <DialogTitle>Record</DialogTitle>
            <DataTypeCell
              column={{
                id: "activations",
                header: "Activations",
                type: "tag",
                tagActions: [
                  {
                    id: "inspect",
                    label: "Inspect",
                    onSelect: () => setChildOpen(true),
                  },
                ],
              }}
              row={row}
              value="Reel"
            />
            <Dialog onOpenChange={setChildOpen} open={childOpen}>
              <DialogContent>
                <DialogTitle>Tag details</DialogTitle>
                <input aria-label="Tag name" />
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      </TableProvider>
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<Example />);
    await pause();
  });
  const tag = document.querySelector<HTMLElement>(".yayaw-tag") as HTMLElement;
  await click(tag);
  expect(Number(menu()?.parentElement?.style.zIndex)).toBe(7001);
  expect(tag.closest('[role="dialog"]')?.contains(menu())).toBe(false);
  await dispatch(
    items()[0] as HTMLElement,
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(Boolean(menu())).toBe(false);
  expect(parentClosed).toBe(false);
  expect(document.activeElement === tag).toBe(true);
  await click(tag);
  await click(items()[0] as HTMLElement);
  expect(parentClosed).toBe(false);
  expect(Boolean(menu())).toBe(false);
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Tag name");
});

it("opens on touch long press without firing the primary click and cancels moved or released touches", async () => {
  let clicks = 0;
  const tag = await renderTag({
    onTagClick: () => clicks++,
    tagActions: [{ id: "edit", label: "Edit", onSelect: () => undefined }],
  });
  const touch = (type: string, x = 0) =>
    new PointerEvent(type, {
      pointerType: "touch",
      clientX: x,
      bubbles: true,
      cancelable: true,
    });
  await dispatch(tag, touch("pointerdown"));
  await act(() => pause(520));
  expect(Boolean(menu())).toBe(true);
  await dispatch(tag, touch("pointerup"));
  await click(tag);
  expect(clicks).toBe(0);
  await click(items()[0] as HTMLElement);
  for (const type of ["pointerup", "pointercancel", "pointermove"]) {
    await dispatch(tag, touch("pointerdown"));
    await dispatch(tag, touch(type, 12));
    await act(() => pause(520));
    expect(Boolean(menu())).toBe(false);
  }
  await click(tag);
  expect(clicks).toBe(1);
});
