const EDITOR_OR_OVERLAY =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

interface SelectionScope {
  root: HTMLElement;
  enabled: () => boolean;
  selectAll?: () => void;
  undo?: () => void;
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
    if (
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      !["a", "z", "d"].includes(event.key.toLowerCase())
    ) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest(EDITOR_OR_OVERLAY)) {
      return;
    }
    // An open portal must keep its shortcuts even when its focus briefly returns to body.
    if (
      [
        ...document.querySelectorAll(
          'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
        ),
      ].some(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.closest('[hidden], [aria-hidden="true"]')
      )
    ) {
      return;
    }
    const scope = resolveScope(manager, document, target);
    if (!(scope?.enabled() && isVisible(scope))) {
      return;
    }
    const commands: Record<string, (() => void) | undefined> = {
      a: scope.selectAll,
      z: scope.undo,
      d: scope.duplicate,
    };
    const command = commands[event.key.toLowerCase()];
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
