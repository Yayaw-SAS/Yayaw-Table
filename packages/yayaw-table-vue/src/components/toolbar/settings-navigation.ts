import type { InjectionKey, ShallowRef } from "vue";

export interface SettingsNavigation {
  title: string;
  back: () => void;
}
/** A nested settings screen reuses the enclosing popover/drawer header. */
export const settingsNavigationKey: InjectionKey<
  ShallowRef<SettingsNavigation | undefined>
> = Symbol("settings-navigation");

/** Closes the enclosing popover or drawer, e.g. before a settings screen opens a larger editor. */
export const settingsMenuCloseKey: InjectionKey<() => void> = Symbol(
  "settings-menu-close"
);

/** Prevents dismissal while an external picker or account popup owns focus. */
export const settingsMenuDismissGuardKey: InjectionKey<
  (guard: (() => boolean) | undefined) => void
> = Symbol("settings-menu-dismiss-guard");
