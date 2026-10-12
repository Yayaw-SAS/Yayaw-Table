"use client";

import { type RefObject, useId } from "react";
import {
  type DeleteConfirmationConfig,
  type DetailLabels,
  deleteConfirmationMatches,
  deleteConfirmationPrompt,
} from "../../utils/record-details";
import "./record-details.css";

/** The field of a typed deletion confirmation: its label names the value to type. */
export function TypedConfirmation({
  confirmation,
  disabled,
  expected,
  inputRef,
  labels,
  onChange,
  onSubmit,
  value,
}: {
  confirmation?: DeleteConfirmationConfig;
  disabled?: boolean;
  expected: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  labels: Pick<DetailLabels, "typeToConfirm" | "confirmationMismatch">;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  value: string;
}) {
  const id = useId();
  const mismatch =
    value.trim() !== "" &&
    !deleteConfirmationMatches(expected, value, confirmation);
  return (
    <div className="yayaw-typed-confirm">
      <label htmlFor={`${id}-input`}>
        {deleteConfirmationPrompt(expected, labels)}
      </label>
      <input
        aria-describedby={mismatch ? `${id}-error` : undefined}
        aria-invalid={mismatch}
        autoCapitalize="off"
        autoComplete="off"
        data-typed-confirmation=""
        disabled={disabled}
        id={`${id}-input`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            deleteConfirmationMatches(expected, value, confirmation)
          ) {
            event.preventDefault();
            onSubmit?.();
          }
        }}
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={value}
      />
      {mismatch ? (
        <p className="yayaw-typed-confirm-error" id={`${id}-error`}>
          {labels.confirmationMismatch}
        </p>
      ) : null}
    </div>
  );
}
