"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** One dialog tree preserves the draft and nested popover focus across viewport changes. */
export function BulkEditorSurface({
  title,
  description,
  closeLabel,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  closeLabel: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || busy)) {
          onClose();
        }
      }}
      open
    >
      <DialogContent
        className="top-auto bottom-0 flex max-h-[90dvh] max-w-full translate-y-0 flex-col gap-0 overflow-clip rounded-b-none p-0 sm:max-w-full md:top-1/2 md:bottom-auto md:max-h-[85dvh] md:max-w-lg md:-translate-y-1/2 md:rounded-xl max-md:[&_button]:min-h-11 max-md:[&_button]:min-w-11 max-md:[&_input]:min-h-11"
        data-bulk-editor=""
        showCloseButton={false}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="space-y-2">
            <DialogTitle className="text-left font-medium text-lg">
              {title}
            </DialogTitle>
            <DialogDescription className="text-left text-muted-foreground text-sm">
              {description}
            </DialogDescription>
          </div>
          <Button
            aria-label={closeLabel}
            disabled={busy}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        {children}
      </DialogContent>
    </Dialog>
  );
}
