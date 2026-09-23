"use client";

import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "../../hooks/use-mobile";
import { useStackMenu } from "../../ui-custom/stack-menu";

export interface ViewSettingField {
  id: string;
  label: string;
  value: string;
  /** Disabled choices stay listed; their label says why. */
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
  /** Section title shown above the field. */
  heading?: string;
  /** Label and control on one row (column mappings). */
  inline?: boolean;
  /** Content right after the field, such as a hint or an input. */
  after?: ReactNode;
  /** Shown but not changeable. */
  disabled?: boolean;
}
export interface ViewSettingProperties {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  showLabels: boolean;
  showLabelsLabel: string;
  onShowLabelsChange: (value: boolean) => void;
}

/** One setting: a select, or on touch layouts a button that opens its choices. */
function SettingFieldRow({
  controlId,
  field,
  mobile,
  onOpen,
}: {
  controlId: string;
  field: ViewSettingField;
  mobile: boolean;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const control = mobile ? (
    <Button
      aria-label={field.label}
      className="w-full min-w-0 justify-between font-normal"
      disabled={field.disabled}
      id={controlId}
      onClick={(event) => onOpen(event.currentTarget)}
      variant="outline"
    >
      <span className="truncate">
        {field.options.find((option) => option.value === field.value)?.label ??
          field.label}
      </span>
      <ChevronDown aria-hidden="true" className="size-4" />
    </Button>
  ) : (
    <Select
      disabled={field.disabled}
      items={field.options}
      onValueChange={(value) => {
        if (value !== null) {
          field.onChange(value);
        }
      }}
      value={field.value}
    >
      <SelectTrigger
        aria-label={field.label}
        className="w-full min-w-0 font-normal"
        id={controlId}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {field.options.map((option) => (
          <SelectItem
            disabled={option.disabled}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return (
    <>
      {field.heading ? (
        <h3 className="mt-1 font-medium text-sm" data-setting-heading>
          {field.heading}
        </h3>
      ) : null}
      <div
        className={
          field.inline
            ? "grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2"
            : "grid min-w-0 gap-1.5"
        }
        data-setting-field={field.id}
      >
        <label
          className={
            field.inline ? "truncate text-sm" : "text-muted-foreground text-sm"
          }
          htmlFor={controlId}
        >
          {field.label}
        </label>
        {control}
      </div>
      {field.after}
    </>
  );
}

/** Mobile choices stay inside the owning drawer, with one scroll region and focus boundary. */
export function ViewSettingsPanel({
  fields,
  properties,
  children,
  intro,
}: {
  children?: ReactNode;
  fields: ViewSettingField[];
  /** Content before the fields, hidden while a choice list is open. */
  intro?: ReactNode;
  properties?: ViewSettingProperties;
}) {
  const isMobile = useIsMobile();
  const { compact, setChildView } = useStackMenu();
  const mobile = isMobile || compact;
  const id = useId();
  const [screen, setScreen] = useState<string>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const activeField = fields.find((field) => field.id === screen);
  const showProperties = screen === "properties" && properties;
  const goBack = useCallback(() => {
    setScreen(undefined);
    // Wait for the settings form to remount before restoring the originating control.
    requestAnimationFrame(() =>
      document.getElementById(trigger.current?.id ?? "")?.focus()
    );
  }, []);
  const screenTitle =
    activeField?.label ?? (showProperties ? properties.label : undefined);
  useLayoutEffect(() => {
    setChildView(
      screenTitle ? { title: screenTitle, back: goBack } : undefined
    );
    return () => setChildView(undefined);
  }, [screenTitle, goBack, setChildView]);
  if (activeField || showProperties) {
    return (
      <div className="grid min-w-0 gap-3" data-view-settings-screen={screen}>
        {activeField ? (
          <RadioGroup
            aria-label={activeField.label}
            className="gap-1"
            onValueChange={(value) => {
              activeField.onChange(String(value));
              goBack();
            }}
            value={activeField.value}
          >
            {activeField.options.map((option) => (
              <label
                className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent"
                htmlFor={`${id}-choice-${option.value}`}
                key={option.value}
              >
                <RadioGroupItem
                  aria-label={option.label}
                  className="min-h-0! min-w-0!"
                  disabled={option.disabled}
                  id={`${id}-choice-${option.value}`}
                  value={option.value}
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        ) : null}
        {showProperties ? (
          <fieldset className="grid min-w-0 gap-1">
            <legend className="sr-only">{properties.label}</legend>
            {properties.options.map((option) => (
              <div
                className="flex min-h-9 min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent max-md:min-h-11"
                key={option.value}
              >
                <Checkbox
                  aria-label={option.label}
                  checked={properties.value.includes(option.value)}
                  className="min-h-0! min-w-0!"
                  id={`${id}-property-${option.value}`}
                  onCheckedChange={(checked) =>
                    properties.onChange(
                      checked
                        ? [
                            ...properties.value.filter(
                              (value) => value !== option.value
                            ),
                            option.value,
                          ]
                        : properties.value.filter(
                            (value) => value !== option.value
                          )
                    )
                  }
                />
                <label
                  className="min-w-0 flex-1 cursor-pointer break-words py-2"
                  htmlFor={`${id}-property-${option.value}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
            <div className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 border-t px-2 pt-2 text-sm">
              <Checkbox
                aria-label={properties.showLabelsLabel}
                checked={properties.showLabels}
                className="min-h-0! min-w-0!"
                id={`${id}-labels`}
                onCheckedChange={properties.onShowLabelsChange}
              />
              <label
                className="flex-1 cursor-pointer py-2"
                htmlFor={`${id}-labels`}
              >
                {properties.showLabelsLabel}
              </label>
            </div>
          </fieldset>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-3" data-view-settings>
      {intro}
      {fields.map((field) => (
        <SettingFieldRow
          controlId={`${id}-${field.id}`}
          field={field}
          key={field.id}
          mobile={mobile}
          onOpen={(button) => {
            trigger.current = button;
            setScreen(field.id);
          }}
        />
      ))}
      {properties ? (
        <Button
          aria-label={properties.label}
          className="w-full justify-start gap-2 font-normal"
          id={`${id}-properties`}
          onClick={(event) => {
            trigger.current = event.currentTarget;
            setScreen("properties");
          }}
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="min-w-0 flex-1 truncate text-left">
            {properties.label}
          </span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
      {children}
    </div>
  );
}
