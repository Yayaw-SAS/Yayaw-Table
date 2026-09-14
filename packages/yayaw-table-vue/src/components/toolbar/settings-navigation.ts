import type { InjectionKey, ShallowRef } from "vue";

export interface SettingsNavigation {
  title: string;
  back: () => void;
}
/** A nested settings screen reuses the enclosing popover/drawer header. */
export const settingsNavigationKey: InjectionKey<
  ShallowRef<SettingsNavigation | undefined>
> = Symbol("settings-navigation");
