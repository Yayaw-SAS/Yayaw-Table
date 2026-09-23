import { type ComputedRef, computed } from "vue";
import { useTableContext } from "../context";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import { GENERIC_MODE_CONFIG_KEYS, modeDefaultsOf } from "../display-modes";

/** Settings of the active mode, saved in the view and URL like built-in modes. */
export const useModeSettingsContext =
  (): ComputedRef<DisplayModeSettingsContext> => {
    const context = useTableContext();
    const translate = (key: string, fallback: string): string => {
      const value = context.translations.value[key];
      return typeof value === "string" ? value : fallback;
    };
    return computed(() => {
      const mode = context.state.displayMode.value;
      const key = GENERIC_MODE_CONFIG_KEYS.find((item) => item === mode);
      const table = context.config.table as unknown as Record<string, unknown>;
      return {
        tableId: context.config.id,
        locale: context.locale,
        columns: context.config.columns.definitions,
        defaults: modeDefaultsOf(table, mode),
        settings: (key && context.state.modeConfigs.value[key]) || {},
        updateSettings: (settings) => {
          if (!key) {
            return;
          }
          const next = { ...context.state.modeConfigs.value };
          if (settings && Object.keys(settings).length > 0) {
            next[key] = settings;
          } else {
            Reflect.deleteProperty(next, key);
          }
          context.state.modeConfigs.value = next;
        },
        translate,
      };
    });
  };
