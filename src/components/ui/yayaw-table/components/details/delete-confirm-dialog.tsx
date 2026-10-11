"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DeleteConfirmationConfig,
  type DetailLabels,
  deleteConfirmationMatches,
} from "../../utils/record-details";
import { TypedConfirmation } from "./typed-confirmation";
import "./record-details.css";

/**
 * A deletion confirmed by typing `expected`: the delete button enables once
 * the typed text matches. The typed field takes the initial focus.
 */
export function TypedDeleteDialog({
  busy,
  confirmation,
  expected,
  labels,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  busy?: boolean;
  confirmation?: DeleteConfirmationConfig;
  expected: string;
  labels: DetailLabels;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const confirmed = deleteConfirmationMatches(expected, typed, confirmation);
  const confirm = () => {
    if (confirmed && !busy) {
      onConfirm();
    }
  };
  return (
    <AlertDialog.Root
      onOpenChange={(next) => {
        if (!(next || busy)) {
          onCancel();
        }
      }}
      onOpenChangeComplete={(next) => {
        if (!next) {
          setTyped("");
        }
      }}
      open={open}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="yayaw-detail-overlay yayaw-detail-overlay-confirm" />
        <AlertDialog.Popup
          className="yayaw-detail-surface yayaw-detail-confirm-surface"
          initialFocus={input}
        >
          <AlertDialog.Title>{labels.confirmDelete}</AlertDialog.Title>
          <AlertDialog.Description>
            {labels.deleteDescription}
          </AlertDialog.Description>
          <strong>{title}</strong>
          <TypedConfirmation
            confirmation={confirmation}
            disabled={busy}
            expected={expected}
            inputRef={input}
            labels={labels}
            onChange={setTyped}
            onSubmit={confirm}
            value={typed}
          />
          <div className="yayaw-detail-actions">
            <Button
              disabled={busy}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              {labels.cancel}
            </Button>
            <Button
              disabled={busy || !confirmed}
              onClick={confirm}
              type="button"
              variant="destructive"
            >
              {busy ? labels.deleting : labels.delete}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
