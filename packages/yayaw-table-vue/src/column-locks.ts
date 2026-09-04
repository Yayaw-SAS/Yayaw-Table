import type { ColumnPinningState, ColumnVisibilityState } from "./types";

const reserved = (id: string): boolean => id === "select" || id === "actions";
const ids = (value: unknown, allowed: string[]): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && allowed.includes(id) && !reserved(id)
          )
        ),
      ]
    : [];

/** Utility columns cannot be moved, hidden, or unpinned by saved or URL state. */
export const lockedColumnOrder = (
  value: unknown,
  allowed: string[]
): string[] => [
  "select",
  ...new Set([
    ...ids(value, allowed),
    ...allowed.filter((id) => !reserved(id)),
  ]),
  "actions",
];

export const lockedColumnVisibility = (
  value: ColumnVisibilityState,
  mandatory: string[]
): ColumnVisibilityState => ({
  ...value,
  ...Object.fromEntries(
    [...mandatory, "select", "actions"].map((id) => [id, true])
  ),
});

export const lockedColumnPinning = (
  value: ColumnPinningState | undefined,
  allowed: string[],
  enabled = true
): ColumnPinningState => {
  const left = enabled ? ids(value?.left, allowed) : [];
  const right = enabled
    ? ids(value?.right, allowed).filter((id) => !left.includes(id))
    : [];
  return { left: ["select", ...left], right: [...right, "actions"] };
};
