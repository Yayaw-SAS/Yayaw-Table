"use client";

import { type ReactNode, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/drawer";
import { DrawerFormPortalContainerContext } from "../components/forms/drawer-form-portal-context";
import { useIsMobile } from "../hooks/use-mobile";

/**
 * "Edit conditions": the rules of one question at a comfortable width, a
 * centered dialog on larger screens and the table's bottom drawer on phones.
 * Changes are saved as they are made; "Done" closes.
 */
export function FormRulesDialog({
  children,
  description,
  doneLabel,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  description: string;
  doneLabel: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const compact = useIsMobile();
  // In the drawer, dropdowns and calendars render inside it so its focus
  // trap keeps them open.
  const portal = useRef<HTMLDivElement>(null);
  const body = (
    <div
      className="grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain px-4 py-3"
      data-form-rules-body
    >
      {children}
    </div>
  );
  const done = (
    <Button onClick={() => onOpenChange(false)} type="button">
      {doneLabel}
    </Button>
  );
  if (compact) {
    return (
      <Drawer onOpenChange={onOpenChange} open={open} repositionInputs={false}>
        <DrawerContent
          className="max-h-[92dvh] overflow-clip pb-[env(safe-area-inset-bottom)] data-[vaul-drawer-direction=bottom]:max-h-[92dvh] [&_button]:min-h-11 [&_[data-slot=select-trigger]]:min-h-11"
          data-form-rules-dialog
        >
          <DrawerFormPortalContainerContext.Provider value={portal}>
            <DrawerHeader className="border-b text-left">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            {body}
            <DrawerFooter className="border-t">{done}</DrawerFooter>
          </DrawerFormPortalContainerContext.Provider>
          <div
            className="pointer-events-none absolute inset-0 *:pointer-events-auto"
            data-form-rules-portal
            ref={portal}
          />
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[min(85dvh,48rem)] flex-col gap-0 p-0 sm:max-w-[40rem]"
        data-form-rules-dialog
      >
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="border-t p-3">{done}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
