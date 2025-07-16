'use client';

import type { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '../../../providers/table-provider';

import type { TranslationConfig } from '../atoms';

export type ValueType = 'boolean' | 'json' | 'number' | 'string';

export interface ValueTypeFieldProps {
  description?: string;
  field: {
    onChange: (value: unknown) => void;
    value: unknown;
  };
  form: UseFormReturn<Record<string, unknown>>;
  label: string;
  placeholder?: string;
  translationConfig?: TranslationConfig;
  valueType: ValueType;
}

// Helper functions for type coercion
function coerceToBooleanType(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value === 'true';
  }
  return Boolean(value);
}

function coerceToJsonType(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function coerceToNumberType(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === '') {
    return 0;
  }
  return Number(value);
}

// Helper function for type coercion
export function coerceToType(value: unknown, type: ValueType): unknown {
  switch (type) {
    case 'boolean':
      return coerceToBooleanType(value);
    case 'json':
      return coerceToJsonType(value);
    case 'number':
      return coerceToNumberType(value);
    case 'string':
      return String(value || '');
    default:
      return value;
  }
}

export function ValueTypeField({
  description,
  field,
  form: _form,
  label,
  placeholder,
  translationConfig: _customTranslationConfig,
  valueType,
}: ValueTypeFieldProps) {
  const { t } = useTranslations();

  // Render different input types based on valueType
  const renderValueInput = () => {
    switch (valueType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={field.value === true}
              onCheckedChange={field.onChange}
            />
            <span className="text-muted-foreground text-sm">
              {field.value ? t('value.enabled') : t('value.disabled')}
            </span>
          </div>
        );
      case 'json':
        return (
          <Textarea
            className="font-mono text-sm"
            onChange={(e) => {
              try {
                // Only update if valid JSON
                const value =
                  e.target.value.trim() === ''
                    ? {}
                    : JSON.parse(e.target.value);
                field.onChange(value);
                // Update the displayed text
                e.target.value = JSON.stringify(value, null, 2);
              } catch (_error) {
                // Keep the invalid JSON in the textarea but don't update the form value
              }
            }}
            placeholder={placeholder || t('value.json_placeholder')}
            rows={5}
            value={(() => {
              if (field.value === undefined) {
                return '';
              }
              if (typeof field.value === 'object') {
                return JSON.stringify(field.value, null, 2);
              }
              return String(field.value);
            })()}
          />
        );
      case 'number':
        return (
          <Input
            onChange={(e) => {
              const value = e.target.value === '' ? '' : Number(e.target.value);
              field.onChange(value);
            }}
            placeholder={placeholder || t('value.number_placeholder')}
            type="number"
            value={field.value === undefined ? '' : String(field.value)}
          />
        );
      default:
        return (
          <Input
            onChange={(e) => field.onChange(e.target.value)}
            placeholder={placeholder || t('value.string_placeholder')}
            type="text"
            value={String(field.value || '')}
          />
        );
    }
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {description && <FormDescription>{description}</FormDescription>}
      <FormControl>{renderValueInput()}</FormControl>
      <FormMessage />
    </FormItem>
  );
}
