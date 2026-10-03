const EDITOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const OVERLAY =
  'dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

interface SelectionScope {
  root: HTMLElement;
  enabled: () => boolean;
  selectAll?: () => void;
  undo?: () => void;
  redo?: () => void;
  duplicate?: () => void;
}

interface SelectionManager {
  scopes: Set<SelectionScope>;
  active?: SelectionScope;
  dispose: () => void;
}

const managers = new WeakMap<Document, SelectionManager>();

function isVisible(scope: SelectionScope): boolean {
  return (
    scope.root.isConnected &&
    !scope.root.closest('[hidden], [inert], [aria-hidden="true"]') &&
    scope.root.getClientRects().length > 0 &&
    scope.root.ownerDocument.defaultView?.getComputedStyle(scope.root)
      .visibility !== "hidden"
  );
}

function scopeForTarget(
  manager: SelectionManager,
  target: Element
): SelectionScope | undefined {
  // Pick the innermost table when a record embeds another table.
  let match: SelectionScope | undefined;
  for (const scope of manager.scopes) {
    if (
      scope.root.contains(target) &&
      (!match || match.root.contains(scope.root))
    ) {
      match = scope;
    }
  }
  return match;
}

function resolveScope(
  manager: SelectionManager,
  document: Document,
  target: Element
): SelectionScope | undefined {
  const direct = scopeForTarget(manager, target);
  if (
    direct ||
    (target !== document.body && target !== document.documentElement)
  ) {
    return direct;
  }
  const candidates = [...manager.scopes].filter(
    (item) => item.enabled() && isVisible(item)
  );
  if (manager.active && candidates.includes(manager.active)) {
    return manager.active;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

type ShortcutName = "selectAll" | "undo" | "redo" | "duplicate";

/** Ctrl/Cmd+A, Z and D; redo is Ctrl/Cmd+Shift+Z, or Ctrl+Y (Cmd+Y stays the browser's on macOS). */
function shortcutName(event: KeyboardEvent): ShortcutName | undefined {
  const key = event.key.toLowerCase();
  if (event.shiftKey) {
    return key === "z" ? "redo" : undefined;
  }
  if (key === "y") {
    return event.ctrlKey ? "redo" : undefined;
  }
  const names: Record<string, ShortcutName> = {
    a: "selectAll",
    z: "undo",
    d: "duplicate",
  };
  return names[key];
}

function createManager(document: Document): SelectionManager {
  const manager: SelectionManager = {
    scopes: new Set(),
    dispose: () => undefined,
  };
  const activate = (event: Event): void => {
    if (event.target instanceof Element) {
      manager.active = scopeForTarget(manager, event.target);
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    const name =
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey
        ? undefined
        : shortcutName(event);
    if (!name) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest(EDITOR)) {
      return;
    }
    const scope = resolveScope(manager, document, target);
    if (!(scope?.enabled() && isVisible(scope))) {
      return;
    }
    // A dialog hosting the table is its page; any other overlay keeps its shortcuts, an open portal
    // included, even when its focus briefly returns to body.
    const above = (overlay: Element | null) =>
      overlay !== null && !overlay.contains(scope.root);
    if (
      above(target.closest(OVERLAY)) ||
      [
        ...document.querySelectorAll(
          'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
        ),
      ].some(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.closest('[hidden], [aria-hidden="true"]') &&
          above(element)
      )
    ) {
      return;
    }
    const command = scope[name];
    if (!command) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) {
      command();
    }
  };
  document.addEventListener("pointerdown", activate, true);
  document.addEventListener("focusin", activate, true);
  document.addEventListener("keydown", onKeyDown, true);
  manager.dispose = () => {
    document.removeEventListener("pointerdown", activate, true);
    document.removeEventListener("focusin", activate, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
  return manager;
}

/** Catch Select All before the browser, including an unfocused single-table page. */
export function registerSelectionShortcuts(scope: SelectionScope): () => void {
  const document = scope.root.ownerDocument;
  let manager = managers.get(document);
  if (!manager) {
    manager = createManager(document);
    managers.set(document, manager);
  }
  manager.scopes.add(scope);
  return () => {
    manager.scopes.delete(scope);
    if (manager.active === scope) {
      manager.active = undefined;
    }
    if (manager.scopes.size === 0) {
      manager.dispose();
      managers.delete(document);
    }
  };
}
