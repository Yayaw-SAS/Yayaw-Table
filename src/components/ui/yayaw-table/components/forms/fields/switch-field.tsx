"use client";

import { Field, FieldError, FieldLabel } from "@/src/components/ui/field";
import { Switch } from "@/src/components/ui/switch";
import { useTranslations } from "../../../providers/table-provider";
import type { CheckboxFieldDefinition, FormFieldApi } from "../types";

interface SwitchFieldProps {
  field: CheckboxFieldDefinition;
  fieldApi: FormFieldApi<boolean>;
}

export function SwitchField({ field, fieldApi }: SwitchFieldProps) {
  const { t } = useTranslations();
  const isChecked = Boolean(fieldApi.state.value);
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const fieldLabel = field.labelKey ? t(field.labelKey) : field.label;
  const enabledStateLabel = (() => {
    const valueEnabled = t("value.enabled");
    if (valueEnabled !== "value.enabled") {
      return valueEnabled;
    }
    const advancedActive = t("filters.advanced.active");
    if (advancedActive !== "filters.advanced.active") {
      return advancedActive;
    }
    return "Enabled";
  })();
  const disabledStateLabel = (() => {
    const valueDisabled = t("value.disabled");
    if (valueDisabled !== "value.disabled") {
      return valueDisabled;
    }
    const advancedOff = t("filters.advanced.off");
    if (advancedOff !== "filters.advanced.off") {
      return advancedOff;
    }
    return "Disabled";
  })();
  const switchStateLabel = isChecked ? enabledStateLabel : disabledStateLabel;

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
        <div className="space-y-0.5">
          <FieldLabel>{fieldLabel}</FieldLabel>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {switchStateLabel}
          </span>
          <Switch
            checked={isChecked}
            onCheckedChange={(val) => fieldApi.handleChange(Boolean(val))}
          />
        </div>
      </div>
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
