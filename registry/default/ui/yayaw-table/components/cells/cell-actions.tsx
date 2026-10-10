"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColumnDefinition } from "../../config/helpers";
import { useTranslations } from "../../providers/table-provider";
import {
  type ResolvedCellAction,
  resolveCellActions,
} from "../../utils/cell-actions";
import { TableTooltip } from "../../utils/table-tooltip";

const COPIED_FEEDBACK_MS = 1500;

/** Actions sit at the control size of the table's density, like row actions. */
const actionClassName = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "[&_svg]:!size-[1.1em] h-[var(--yayaw-inline-control-height,1.75rem)] min-w-[var(--yayaw-inline-control-height,1.75rem)] gap-1 px-1 font-normal text-[length:inherit] text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
);

// Actions keep their clicks: no row click, no inline edit, no drag.
const stop = (event: SyntheticEvent) => event.stopPropagation();

function CellActionControl({
  action,
  copiedLabel,
}: {
  action: ResolvedCellAction<ReactNode>;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const isCopy = action.copyText !== undefined;
  const label = copied ? copiedLabel : action.label;
  let icon = action.icon;
  if (isCopy) {
    icon = copied ? <Check aria-hidden /> : <Copy aria-hidden />;
  }
  const content = (
    <>
      {icon ?? <span>{action.label}</span>}
      {action.count === undefined ? null : (
        <span className="tabular-nums">{action.count}</span>
      )}
    </>
  );
  const iconOnly = Boolean(icon) && action.count === undefined;
  const common = {
    "aria-label": label,
    onDoubleClick: stop,
    onKeyDown: stop,
    onPointerDown: stop,
    className: cn(
      actionClassName,
      iconOnly && "px-0",
      action.reveal === "hover" &&
        "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/cell-actions:opacity-100 [@media(hover:hover)]:group-hover/cell-actions:opacity-100"
    ),
    "data-cell-action": action.id,
  };

  if (action.href) {
    return (
      <TableTooltip label={label}>
        <a
          {...common}
          href={action.href}
          onClick={stop}
          rel="noopener noreferrer"
          target="_blank"
        >
          {content}
        </a>
      </TableTooltip>
    );
  }

  const run = async () => {
    if (isCopy) {
      await navigator.clipboard.writeText(action.copyText ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      return;
    }
    await action.run?.();
  };

  return (
    <TableTooltip label={label}>
      <button
        {...common}
        // aria-disabled keeps the click here, where it is ignored, instead of on the row.
        aria-disabled={action.disabled || undefined}
        onClick={(event) => {
          stop(event);
          if (!action.disabled) {
            run();
          }
        }}
        type="button"
      >
        {content}
      </button>
    </TableTooltip>
  );
}

/** A cell's value followed by its column's `cellActions` (and copy). */
export function CellWithActions({
  children,
  column,
  row,
  value,
}: {
  children?: ReactNode;
  column: ColumnDefinition;
  row: Record<string, unknown>;
  value: unknown;
}) {
  const { t } = useTranslations();
  const actions = resolveCellActions(column, row, value, t("actions.copy"));
  if (actions.length === 0) {
    return children;
  }
  return (
    <span className="group/cell-actions flex w-full min-w-0 items-center gap-1">
      <span className="min-w-0 truncate">{children}</span>
      <span className="flex shrink-0 items-center" data-cell-actions="">
        {actions.map((action) => (
          <CellActionControl
            action={action}
            copiedLabel={t("actions.copied")}
            key={action.id}
          />
        ))}
      </span>
    </span>
  );
}
