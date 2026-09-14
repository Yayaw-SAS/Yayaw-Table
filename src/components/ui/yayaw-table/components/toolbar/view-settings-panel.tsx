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
import { useStackMenu } from "@/components/ui/custom/stack-menu";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/src/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useIsMobile } from "../../hooks/use-mobile";

export interface ViewSettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
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

/** Mobile choices stay inside the owning drawer, with one scroll region and focus boundary. */
export function ViewSettingsPanel({
  fields,
  properties,
  children,
}: {
  children?: ReactNode;
  fields: ViewSettingField[];
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
            value={activeField.value}
            onValueChange={(value) => {
              activeField.onChange(String(value));
              goBack();
            }}
          >
            {activeField.options.map((option) => (
              <label
                htmlFor={`${id}-choice-${option.value}`}
                className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent"
                key={option.value}
              >
                <RadioGroupItem
                  id={`${id}-choice-${option.value}`}
                  aria-label={option.label}
                  className="min-h-0! min-w-0!"
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
                  id={`${id}-property-${option.value}`}
                  className="min-h-0! min-w-0!"
                  checked={properties.value.includes(option.value)}
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
                id={`${id}-labels`}
                className="min-h-0! min-w-0!"
                checked={properties.showLabels}
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
      {fields.map((field) => (
        <div className="grid min-w-0 gap-1.5" key={field.id}>
          <label
            className="text-muted-foreground text-sm"
            htmlFor={`${id}-${field.id}`}
          >
            {field.label}
          </label>
          {mobile ? (
            <Button
              id={`${id}-${field.id}`}
              aria-label={field.label}
              className="w-full justify-between font-normal"
              variant="outline"
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setScreen(field.id);
              }}
            >
              <span className="truncate">
                {field.options.find((option) => option.value === field.value)
                  ?.label ?? field.label}
              </span>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Button>
          ) : (
            <Select
              value={field.value}
              items={field.options}
              onValueChange={(value) => {
                if (value !== null) {
                  field.onChange(value);
                }
              }}
            >
              <SelectTrigger
                aria-label={field.label}
                className="w-full min-w-0 font-normal"
                id={`${id}-${field.id}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                {field.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
      {properties ? (
        <Button
          aria-label={properties.label}
          className="w-full justify-start gap-2 font-normal"
          id={`${id}-properties`}
          variant="outline"
          onClick={(event) => {
            trigger.current = event.currentTarget;
            setScreen("properties");
          }}
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
