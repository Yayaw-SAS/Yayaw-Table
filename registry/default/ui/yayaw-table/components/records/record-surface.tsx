"use client";

import { X } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  RECORD_MOBILE_QUERY,
  type RecordPresentationConfig,
  recordSurfaceWidth,
  resolveRecordPresentation,
} from "../../utils/record-presentation";
import "./record-surface.css";

function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(RECORD_MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const mobileSnapshot = () => window.matchMedia(RECORD_MOBILE_QUERY).matches;
const serverSnapshot = () => false;

export function useRecordPresentation(presentation?: RecordPresentationConfig) {
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot
  );
  return resolveRecordPresentation(presentation, mobile);
}

/** Drawer and modal share one dialog tree, preserving drafts and nested field focus. */
export function RecordSurface({
  presentation,
  width,
  title,
  open = true,
  busy = false,
  embedded = false,
  onClose,
  children,
  bulk = false,
}: {
  presentation?: RecordPresentationConfig;
  width?: string;
  title: string;
  open?: boolean;
  busy?: boolean;
  embedded?: boolean;
  bulk?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const mode = useRecordPresentation(presentation);
  const inline = mode === "inline";
  // Move one portal target between the inline and overlay hosts. React keeps every
  // field mounted, including custom field state, while Shadcn owns modal focus.
  const [content] = useState(() => {
    if (embedded || typeof document === "undefined") {
      return null;
    }
    const element = document.createElement("div");
    element.className = "yayaw-record-content";
    return element;
  });
  const mountContent = useCallback(
    (element: HTMLDivElement | null) => {
      if (element && content) {
        element.append(content);
      }
    },
    [content]
  );
  if (!open) {
    return null;
  }
  if (embedded) {
    return children;
  }
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!(next || busy || inline)) {
          onClose();
        }
      }}
      open={!inline}
    >
      {content && createPortal(children, content)}
      {inline ? (
        <section
          aria-label={title}
          className="yayaw-record-surface"
          data-bulk-editor={bulk ? "" : undefined}
          data-presentation="inline"
        >
          <div className="yayaw-record-content" ref={mountContent} />
        </section>
      ) : (
        <DialogContent
          aria-describedby={undefined}
          className="yayaw-record-surface"
          data-bulk-editor={bulk ? "" : undefined}
          data-presentation={mode}
          showCloseButton={false}
          style={
            {
              "--record-width": recordSurfaceWidth(mode, width),
            } as CSSProperties
          }
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="yayaw-record-content" ref={mountContent} />
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Shared Shadcn header hierarchy; actions remain specific to the active operation. */
export function RecordSurfaceHeader({
  title,
  description,
  closeLabel,
  busy,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  closeLabel: string;
  busy?: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="yayaw-record-header">
      <div className="yayaw-record-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
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
  );
}
