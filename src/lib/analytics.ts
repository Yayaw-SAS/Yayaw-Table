/**
 * Reserved analytics hooks for future instrumentation.
 *
 * This module intentionally ships no-op handlers so the UI can keep stable call sites
 * without emitting events in production during this iteration.
 */

export interface InstallCtaEvent {
  locale: string;
  source: "docs" | "example" | "home" | "header";
}

export interface LocaleSwitchEvent {
  fromLocale: string;
  nextLocale: string;
  pathname: string;
}

export const analyticsSlots = {
  trackInstallCtaClick: (_event: InstallCtaEvent): void => {
    // Intentionally no-op until analytics integration is enabled.
  },
  trackLocaleSwitch: (_event: LocaleSwitchEvent): void => {
    // Intentionally no-op until analytics integration is enabled.
  },
};
