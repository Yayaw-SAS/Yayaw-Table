/**
 * Shared keyboard activation rules for card display modes.
 */
export function shouldActivateCardFromKeyboard({
  currentTarget,
  key,
  target,
}: {
  currentTarget: EventTarget;
  key: string;
  target: EventTarget | null;
}): boolean {
  return currentTarget === target && (key === "Enter" || key === " ");
}
