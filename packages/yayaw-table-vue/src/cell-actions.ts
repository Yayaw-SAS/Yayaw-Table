/**
 * Cell actions: small controls declared on a column and drawn after its value
 * (add a note, edit the contacts, open the record, copy the value). The engine
 * renders them at the table's control size, so they follow the density like
 * row actions do. Framework-neutral: also copied into the Vue registry.
 */

export type CellActionReveal = "always" | "hover";

type CellActionRow = Record<string, unknown>;

export interface CellActionDefinition<
  TRow extends CellActionRow = CellActionRow,
  TIcon = unknown,
> {
  id: string;
  /** Accessible name and tooltip. Shown as text when the action has no icon. */
  label: string;
  icon?: TIcon;
  /** Opens this URL in a new tab instead of calling `onClick`. */
  href?: (row: TRow) => string | undefined;
  onClick?: (row: TRow, value: unknown) => unknown;
  /** A number drawn next to the icon, such as the record's notes. Hidden at 0. */
  count?: (row: TRow) => number | undefined;
  /** Default true. */
  visible?: (row: TRow) => boolean;
  disabled?: (row: TRow) => boolean;
  /** `hover` shows the action while the row is hovered or focused; touch screens always show it. Default `always`. */
  reveal?: CellActionReveal;
}

export interface CellActionColumn<
  TRow extends CellActionRow = CellActionRow,
  TIcon = unknown,
> {
  cellActions?: CellActionDefinition<TRow, TIcon>[];
  /** Adds a copy action that writes the cell's value to the clipboard. */
  copyable?: boolean;
}

export interface ResolvedCellAction<TIcon = unknown> {
  id: string;
  label: string;
  icon?: TIcon;
  href?: string;
  count?: number;
  disabled: boolean;
  reveal: CellActionReveal;
  /** The text a copy action writes; absent on other actions. */
  copyText?: string;
  run?: () => unknown;
}

export const COPY_CELL_ACTION_ID = "copy";

/** The text a copyable cell writes: lists join like the cells show them. */
export function cellCopyText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map(cellCopyText)
      .filter((item) => item !== "")
      .join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** The actions one cell shows, in declaration order, the copy action last. */
export function resolveCellActions<TRow extends CellActionRow, TIcon>(
  column: CellActionColumn<TRow, TIcon>,
  row: TRow,
  value: unknown,
  copyLabel: string
): ResolvedCellAction<TIcon>[] {
  const actions: ResolvedCellAction<TIcon>[] = [];
  for (const action of column.cellActions ?? []) {
    if (action.visible?.(row) === false) {
      continue;
    }
    const href = action.href?.(row);
    if (action.href && !href) {
      continue;
    }
    const count = action.count?.(row);
    const onClick = action.onClick;
    actions.push({
      id: action.id,
      label: action.label,
      icon: action.icon,
      href,
      count: count && count > 0 ? count : undefined,
      disabled: action.disabled?.(row) ?? false,
      reveal: action.reveal ?? "always",
      run: href || !onClick ? undefined : () => onClick(row, value),
    });
  }
  const copyText = column.copyable ? cellCopyText(value) : "";
  if (copyText) {
    actions.push({
      id: COPY_CELL_ACTION_ID,
      label: copyLabel,
      disabled: false,
      reveal: "hover",
      copyText,
    });
  }
  return actions;
}
