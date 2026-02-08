"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "../../../providers/table-provider";

import type { FormFieldApi } from "../types";

export interface SelectWithAddNewFieldProps {
  allowCreate?: boolean;
  description?: string;
  fieldApi: FormFieldApi<string | null>;
  items?: string[];
  label: string;
  name: string;
  onItemsChange?: (items: string[]) => void;
  optionsLoader?: () => Promise<string[]>;
  placeholder?: string;
}

export function SelectWithAddNewField({
  allowCreate = true,
  description,
  fieldApi,
  items = [],
  label,
  name,
  onItemsChange,
  optionsLoader,
  placeholder,
}: SelectWithAddNewFieldProps) {
  const { t } = useTranslations();
  const [showAddNew, setShowAddNew] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [localItems, setLocalItems] = useState<string[]>([]);
  const [selectKey, setSelectKey] = useState(0);

  const { data: loadedItems = [] } = useQuery({
    enabled: !!optionsLoader,
    queryFn: async () => (optionsLoader ? await optionsLoader() : []),
    queryKey: [`select-options-${name}`],
    staleTime: 5 * 60 * 1000,
  });

  const allItems = [...new Set([...items, ...loadedItems, ...localItems])];

  const updateFormValue = (value: string) => {
    fieldApi.handleChange(value);
    setNewItem("");
    setShowAddNew(false);
    setSelectKey((prev) => prev + 1);
  };

  const handleAddNew = () => {
    const trimmedItem = newItem.trim();
    if (!trimmedItem) {
      return;
    }
    if (!allItems.includes(trimmedItem)) {
      setLocalItems((prev) => [...prev, trimmedItem]);
      onItemsChange?.([...items, trimmedItem]);
    }
    updateFormValue(trimmedItem);
  };

  const handleSelectChange = (value: string | null) => {
    if (value === "add-new-item") {
      setShowAddNew(true);
      return;
    }
    fieldApi.handleChange(value == null || value === "" ? null : value);
  };

  useEffect(() => {
    const fieldValue = fieldApi.state.value;
    if (!fieldValue && showAddNew) {
      setShowAddNew(false);
    }
  }, [fieldApi.state.value, showAddNew]);

  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((e) => (typeof e === "string" ? e : String(e)))
    : [];
  const rawValue = fieldApi.state.value;
  const value = rawValue == null || rawValue === "" ? null : String(rawValue);

  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel>{label}</FieldLabel>
      {description != null && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {showAddNew ? (
        <div className="flex items-center space-x-2">
          <Input
            autoFocus
            name={`new-${name}-input`}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNew();
              } else if (e.key === "Escape") {
                setShowAddNew(false);
              }
            }}
            placeholder={t("new_item_placeholder", { fallback: "New item" })}
            value={newItem}
          />
          <Button
            data-testid={`add-${name}-button`}
            onClick={handleAddNew}
            size="sm"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowAddNew(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Select
          key={`select-${name}-${selectKey}`}
          onValueChange={(v) => handleSelectChange(v ?? null)}
          value={value}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                placeholder ??
                t("select_placeholder", { fallback: "Select..." })
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {allItems.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
              {allowCreate && (
                <>
                  <SelectSeparator />
                  <SelectItem value="add-new-item">
                    <span className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("categories.add_new", { fallback: "Add new" })}
                    </span>
                  </SelectItem>
                </>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
