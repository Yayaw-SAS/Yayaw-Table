/**
 * View tabs shared by the React and Vue editions: which saved views show as
 * tabs and which move to the "More" menu.
 */

export interface ViewTabsSettings {
  /** Tabs shown before the rest move to the "More" menu (default 4). */
  maxVisible?: number;
}

/** `table.viewTabs`: `false` keeps the view menu only. */
export type ViewTabsConfig = boolean | ViewTabsSettings;

export const DEFAULT_VIEW_TABS_MAX_VISIBLE = 4;

/** Resolved tab settings, or `undefined` when tabs are turned off. */
export function resolveViewTabs(
  config: ViewTabsConfig | undefined
): Required<ViewTabsSettings> | undefined {
  if (config === false) {
    return;
  }
  const requested = typeof config === "object" ? config.maxVisible : undefined;
  const maxVisible =
    typeof requested === "number" &&
    Number.isInteger(requested) &&
    requested > 0
      ? requested
      : DEFAULT_VIEW_TABS_MAX_VISIBLE;
  return { maxVisible };
}

/**
 * Split views into visible tabs and the overflow menu, keeping their order.
 * The active view always stays visible, in place of the last visible tab.
 */
export function splitViewTabs<TView extends { id: string }>(
  views: readonly TView[],
  activeId: string | null | undefined,
  maxVisible: number
): { visible: TView[]; overflow: TView[] } {
  if (views.length <= maxVisible) {
    return { visible: [...views], overflow: [] };
  }
  const visible = views.slice(0, maxVisible);
  const active = views.find((view) => view.id === activeId);
  if (active && !visible.includes(active)) {
    visible[visible.length - 1] = active;
  }
  return {
    visible,
    overflow: views.filter((view) => !visible.includes(view)),
  };
}
