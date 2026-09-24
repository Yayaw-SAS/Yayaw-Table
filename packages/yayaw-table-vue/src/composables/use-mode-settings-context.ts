import { type ComputedRef, computed } from "vue";
import { type TableContextValue, useTableContext } from "../context";
import type { DisplayModeSettingsContext } from "../display-mode-renderer";
import { GENERIC_MODE_CONFIG_KEYS, modeDefaultsOf } from "../display-modes";
import { formCreateFields } from "../form-view";

/** Fields of the table's create form, when the host declares one (`getFormConfig`). */
function createFormFields(
  context: TableContextValue
): readonly string[] | undefined {
  const tableType = context.tableType ?? context.config.id;
  const formType =
    context.config.form?.createFormType ?? context.formType ?? tableType;
  try {
    return formCreateFields(
      context.getFormConfig?.(formType, {
        formType,
        locale: context.locale,
        mode: "create",
        tableId: context.config.id,
        tableType,
        values: {},
      })?.fields
    );
  } catch {
    // A host form that cannot be built without a record limits nothing.
    return;
  }
}

/** Settings of the active mode, saved in the view and URL like built-in modes. */
export const useModeSettingsContext =
  (): ComputedRef<DisplayModeSettingsContext> => {
    const context = useTableContext();
    const translate = (key: string, fallback: string): string => {
      const value = context.translations.value[key];
      return typeof value === "string" ? value : fallback;
    };
    // The Form mode asks what the create form offers, when the host declares it.
    const formFields = computed(() => createFormFields(context));
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
        formFields: formFields.value,
      };
    });
  };
