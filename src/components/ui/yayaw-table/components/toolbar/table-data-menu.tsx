"use client";

import { useAtom } from "jotai";
import { Database } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { tableDataMenuOpenToViewAtom } from "../../atoms/table-atoms";
import { TableTooltip } from "../../utils/table-tooltip";

/**
 * Actions on the data, apart from how the view looks: Export, Connect and
 * Share, each opening its own screen.
 */
export function TableDataMenu({
  compact,
  label,
  rows,
  screens,
  tableId,
}: {
  compact: boolean;
  label: string;
  rows: ReactNode;
  screens: { name: string; title: string; content: ReactNode }[];
  tableId: string;
}) {
  const [open, setOpen] = useState(false);
  const [openToView, setOpenToView] = useAtom(
    tableDataMenuOpenToViewAtom(tableId)
  );
  return (
    <StackMenu
      asDropdown
      compact={compact}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setOpenToView(null);
        }
      }}
      open={open || Boolean(openToView)}
      openToView={openToView ?? undefined}
      trigger={
        <TableTooltip label={label}>
          <Button
            aria-label={label}
            className={cn("size-8 shrink-0", compact && "size-11")}
            size="icon"
            type="button"
            variant="outline"
          >
            <Database aria-hidden="true" className="size-4" />
          </Button>
        </TableTooltip>
      }
    >
      <StackMenuView name="main" title={label}>
        <StackMenuContent data-menu-section="data">{rows}</StackMenuContent>
      </StackMenuView>
      {screens.map((screen) => (
        <StackMenuView key={screen.name} name={screen.name} title={screen.title}>
          {screen.content}
        </StackMenuView>
      ))}
    </StackMenu>
  );
}
