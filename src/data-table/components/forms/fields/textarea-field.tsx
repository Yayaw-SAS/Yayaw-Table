'use client';

import type { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '../../../providers/table-provider';

import type { TextareaFieldDefinition } from '../types';

interface TextareaFieldProps {
  field: TextareaFieldDefinition;
  form: UseFormReturn<Record<string, unknown>>;
}

export function TextareaField({ field, form }: TextareaFieldProps) {
  const { t } = useTranslations();

  return (
    <FormField
      control={form.control}
      name={field.name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>
            {field.labelKey ? t(field.labelKey) : field.label}
          </FormLabel>
          <FormControl>
            <Textarea
              {...formField}
              className="min-h-[100px]"
              placeholder={
                field.placeholderKey
                  ? t(field.placeholderKey)
                  : field.placeholder
              }
              value={String(formField.value || '')}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
