import assert from "node:assert/strict";
import type { registerSelectionShortcuts } from "../src/components/ui/yayaw-table/utils/selection-shortcuts";

type Test = (name: string, run: () => void) => void;

export function selectionShortcutsSuite(
  test: Test,
  register: typeof registerSelectionShortcuts
): void {
  const setup = () => {
    const roots: HTMLElement[] = [];
    const cleanup: (() => void)[] = [];
    const scope = (enabled = true) => {
      const root = document.createElement("section");
      document.body.append(root);
      Object.defineProperty(root, "getClientRects", {
        value: () => [{ width: 600, height: 400 }],
        configurable: true,
      });
      let selected = 0;
      let undone = 0;
      cleanup.push(
        register({
          root,
          enabled: () => enabled,
          selectAll: () => {
            selected += 1;
          },
          undo: () => {
            undone += 1;
          },
        })
      );
      roots.push(root);
      return {
        root,
        get selected() {
          return selected;
        },
        get undone() {
          return undone;
        },
      };
    };
    const press = (
      target: Element,
      key = "a",
      init: KeyboardEventInit = {}
    ) => {
      const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return {
      scope,
      press,
      destroy: () => {
        for (const stop of cleanup) {
          stop();
        }
        for (const root of roots) {
          root.remove();
        }
      },
    };
  };
  test("captures Ctrl/Cmd+A before the browser even when focus stays on body", () => {
    const f = setup();
    try {
      const table = f.scope();
      assert.equal(f.press(document.body), true);
      assert.equal(
        f.press(document.body, "A", { ctrlKey: false, metaKey: true }),
        true
      );
      assert.equal(table.selected, 2);
    } finally {
      f.destroy();
    }
  });
  test("routes commands only to the active table on multi-table pages", () => {
    const f = setup();
    try {
      const first = f.scope();
      const second = f.scope();
      assert.equal(f.press(document.body), false);
      second.root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      assert.equal(f.press(document.body), true);
      assert.equal(first.selected, 0);
      assert.equal(second.selected, 1);
      assert.equal(f.press(first.root), true);
      assert.equal(first.selected, 1);
    } finally {
      f.destroy();
    }
  });
  test("preserves native selection and undo in editors and dialogs", () => {
    const f = setup();
    try {
      const table = f.scope();
      for (const tag of ["input", "textarea", "select", "dialog"]) {
        const target = document.createElement(tag);
        table.root.append(target);
        assert.equal(f.press(target), false);
        assert.equal(f.press(target, "z"), false);
        target.remove();
      }
      const editor = document.createElement("div");
      editor.setAttribute("contenteditable", "true");
      table.root.append(editor);
      assert.equal(f.press(editor), false);
      assert.equal(table.selected, 0);
      assert.equal(table.undone, 0);
    } finally {
      f.destroy();
    }
  });
  test("does not steal shortcuts from unrelated page controls or an open portal", () => {
    const f = setup();
    const button = document.createElement("button");
    const dialog = document.createElement("div");
    try {
      f.scope();
      document.body.append(button, dialog);
      assert.equal(f.press(button), false);
      dialog.setAttribute("role", "dialog");
      Object.defineProperty(dialog, "getClientRects", { value: () => [{}] });
      assert.equal(f.press(document.body), false);
    } finally {
      button.remove();
      dialog.remove();
      f.destroy();
    }
  });
  test("ignores disabled or hidden tables and unregisters cleanly", () => {
    const f = setup();
    try {
      f.scope(false);
      const table = f.scope();
      table.root.hidden = true;
      assert.equal(f.press(document.body), false);
    } finally {
      f.destroy();
    }
    assert.equal(f.press(document.body), false);
  });
  test("dispatches one undo per keypress and suppresses repeated keydown", () => {
    const f = setup();
    try {
      const table = f.scope();
      assert.equal(f.press(document.body, "z"), true);
      assert.equal(f.press(document.body, "z", { repeat: true }), true);
      assert.equal(table.undone, 1);
      assert.equal(table.selected, 0);
    } finally {
      f.destroy();
    }
  });
}
