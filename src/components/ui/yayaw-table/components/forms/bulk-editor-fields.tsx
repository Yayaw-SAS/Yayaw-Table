"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/src/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import type { BulkEditorMessages } from "../../utils/bulk-editor";
import { FormBuilder } from "./form-builder";
import { formValuesEqual } from "./form-runtime";
import type { FormBuilderFormInstance } from "./hooks/use-form-builder";
import type {
  AnyFieldDefinition,
  FieldValues,
  FormConfigContext,
} from "./types";

export function BulkEditorFields({
  fields,
  available,
  clearValues,
  context,
  form,
  messages,
  disabled,
  onAdd,
  onRemove,
}: {
  fields: AnyFieldDefinition[];
  available: AnyFieldDefinition[];
  clearValues: FieldValues;
  context: FormConfigContext;
  form: FormBuilderFormInstance<FieldValues>;
  messages: BulkEditorMessages;
  disabled: boolean;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <fieldset className="space-y-5" disabled={disabled}>
      {!fields.length && (
        <p className="py-3 text-muted-foreground text-sm">{messages.empty}</p>
      )}
      {fields.map((field) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1"
          data-bulk-field={field.name}
          key={field.name}
        >
          <FormBuilder
            asFieldset
            context={context}
            disabled={disabled}
            fields={[field]}
            form={form}
            showFormErrors={false}
          />
          <Button
            aria-label={messages.removeField.replace("{field}", field.label)}
            className="mt-6"
            onClick={() => {
              onRemove(field.name);
              trigger.current?.focus();
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
          {Object.hasOwn(clearValues, field.name) && (
            <Button
              className="col-start-1 w-fit px-0 text-muted-foreground"
              disabled={formValuesEqual(
                context.values?.[field.name],
                clearValues[field.name]
              )}
              onClick={() =>
                form.setFieldValue(field.name, clearValues[field.name])
              }
              size="sm"
              type="button"
              variant="link"
            >
              {messages.clearValue}
            </Button>
          )}
        </div>
      ))}
      <Popover onOpenChange={setPickerOpen} open={pickerOpen && !disabled}>
        <PopoverTrigger
          render={
            <Button
              disabled={disabled || !available.length}
              ref={trigger}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" />
              {messages.addField}
            </Button>
          }
        />
        <PopoverContent
          align="start"
          className="w-[min(18rem,calc(100vw-2rem))] gap-0 p-0"
        >
          <Command>
            <CommandInput
              aria-label={messages.searchFields}
              placeholder={messages.searchFields}
            />
            <CommandList className="max-h-[min(16rem,40dvh)]">
              <CommandEmpty>{messages.noFields}</CommandEmpty>
              {available.map((field) => (
                <CommandItem
                  className="min-h-11 md:min-h-8"
                  data-bulk-option={field.name}
                  key={field.name}
                  keywords={[field.label]}
                  onSelect={() => {
                    onAdd(field.name);
                    setPickerOpen(false);
                  }}
                  value={field.name}
                >
                  {field.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </fieldset>
  );
}
