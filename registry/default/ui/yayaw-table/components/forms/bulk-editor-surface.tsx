"use client";
import type { ComponentProps } from "react";
import { RecordSurface, RecordSurfaceHeader } from "../records/record-surface";

/** Bulk editing uses the same surface as individual records. */
export function BulkEditorSurface({
  description,
  closeLabel,
  ...props
}: ComponentProps<typeof RecordSurface> & {
  description: string;
  closeLabel: string;
}) {
  return (
    <RecordSurface {...props} bulk>
      <RecordSurfaceHeader
        busy={props.busy}
        closeLabel={closeLabel}
        description={description}
        onClose={props.onClose}
        title={props.title}
      />
      {props.children}
    </RecordSurface>
  );
}
