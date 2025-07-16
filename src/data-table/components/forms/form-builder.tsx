/**
 * Form builder component
 * This component renders a form based on field definitions
 */
'use client';

// Debug flag to control logging
const DEBUG = false;

import { type ReactNode, useEffect } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useTranslations } from '../../providers/table-provider';

import {
  CheckboxField,
  DynamicValueField,
  NumberField,
  SelectField,
  SelectWithAddNewField,
  SwitchField,
  TextareaField,
  TextField,
  ValueTypeField,
} from './fields';
import type { AnyFieldDefinition, DynamicValueFieldDefinition } from './types';

interface FormBuilderProps<TFieldValues extends FieldValues> {
  /**
   * Additional actions to render in the form footer
   */
  actions?: ReactNode;

  /**
   * Additional class name for the form
   */
  className?: string;

  /**
   * Whether to disable the form
   */
  disabled?: boolean;

  /**
   * Field definitions
   */
  fields: AnyFieldDefinition<TFieldValues>[];

  /**
   * Form instance
   */
  form: UseFormReturn<TFieldValues>;

  /**
   * Whether the form is submitting
   */
  isSubmitting?: boolean;

  /**
   * Form submission handler
   */
  onSubmit: (values: TFieldValues) => Promise<void> | void;

  /**
   * Submit button text
   * If set to null, the submit button will not be rendered
   */
  submitText?: null | string;
}

/**
 * Interface for dynamic field updates
 */
interface DynamicFieldUpdate {
  name: string;
  value: unknown;
}

/**
 * Interface for dynamic field updates map on window
 */
interface WindowWithDynamicUpdates extends Window {
  __dynamicFieldUpdates?: Map<string, DynamicFieldUpdate>;
}

/**
 * Form builder component
 * Renders a form based on field definitions
 */
export function FormBuilder<TFieldValues extends FieldValues>({
  actions,
  className,
  disabled = false,
  fields,
  form,
  isSubmitting = false,
  onSubmit,
  submitText,
}: FormBuilderProps<TFieldValues>) {
  // Setup dependencies for fields that depend on other fields
  useEffect(() => {
    if (DEBUG) {
      // DEBUG: Setting up field dependencies
    }

    // Filter fields that have dependencies (only DynamicValueFieldDefinition has dependsOn)
    const fieldsWithDependencies = fields.filter(
      (field): field is DynamicValueFieldDefinition<TFieldValues> =>
        field.type === 'dynamic-value' && 'dependsOn' in field
    );

    if (fieldsWithDependencies.length === 0) {
      return;
    }

    if (DEBUG) {
      // DEBUG: Dependencies configured
    }

    // Helper function to check if field should be transformed
    const shouldTransformField = (fieldName: string, fieldType: string) => {
      const isValueField = fieldName === 'value';
      const isDynamicValueField = fieldType === 'dynamic-value';
      return !(isDynamicValueField || isValueField);
    };

    // Helper function to apply transform and set field value
    const applyTransformAndSetValue = (
      field: DynamicValueFieldDefinition<TFieldValues>,
      currentValue: unknown,
      shouldDirty = false
    ) => {
      try {
        const transformedValue = field.dependsOn.transform(currentValue);

        // Only set the value if it's different from the current value
        const currentFieldValue = form.getValues(
          field.name as Path<TFieldValues>
        );
        if (transformedValue !== currentFieldValue) {
          form.setValue(
            field.name,
            transformedValue as TFieldValues[Path<TFieldValues>],
            {
              shouldDirty,
              shouldValidate: shouldDirty,
            }
          );
        }
      } catch (_error) {
        // Ignore value setting errors
      }
    };

    // Helper function to set initial field value based on dependency
    const setInitialFieldValue = (
      field: DynamicValueFieldDefinition<TFieldValues>
    ) => {
      const dependencyField = field.dependsOn.field as Path<TFieldValues>;
      const fieldName = field.name as string;
      const fieldType = field.type;

      // Only apply transform to non-dynamic-value fields
      // For dynamic-value fields, the transform is only used to determine the field type
      if (shouldTransformField(fieldName, fieldType)) {
        const currentValue = form.getValues(dependencyField);

        // If there's an initial value, apply the transform
        if (currentValue) {
          applyTransformAndSetValue(field, currentValue, false);
        }
      }
    };

    // Helper function to create field dependency subscription
    const createFieldSubscription = (
      field: DynamicValueFieldDefinition<TFieldValues>
    ) => {
      const dependencyField = field.dependsOn.field as Path<TFieldValues>;
      const fieldName = field.name as string;
      const fieldType = field.type;

      return form.watch((formValues, { name, type }) => {
        // Only process if the changed field is our dependency
        if (name === dependencyField && type === 'change' && formValues) {
          const dependencyValue = formValues[dependencyField];
          if (
            dependencyValue !== undefined &&
            shouldTransformField(fieldName, fieldType)
          ) {
            // Update the dependent field
            applyTransformAndSetValue(field, dependencyValue, true);
          }
        }
      });
    };

    // Set up dependencies for fields
    const subscriptions = fieldsWithDependencies.map((field) => {
      // Set initial value based on dependency
      setInitialFieldValue(field);

      // Subscribe to changes in the dependency field
      return createFieldSubscription(field);
    });

    // Clean up subscriptions when component unmounts
    return () => {
      for (const subscription of subscriptions) {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      }
    };
  }, [form, fields]);

  // Effect to process dynamic field value updates after render
  // This addresses the "Cannot update component during render" error
  useEffect(() => {
    const windowWithUpdates = window as WindowWithDynamicUpdates;
    const dynamicFieldUpdates = windowWithUpdates.__dynamicFieldUpdates;
    if (dynamicFieldUpdates && dynamicFieldUpdates.size > 0) {
      // Process each update after render is complete
      for (const update of dynamicFieldUpdates.values()) {
        try {
          if (DEBUG) {
            // DEBUG: Updating dynamic field value
          }

          form.setValue(
            update.name as Path<TFieldValues>,
            update.value as TFieldValues[Path<TFieldValues>],
            {
              shouldDirty: false,
            }
          );
        } catch (_error) {
          // Ignore subscription cleanup errors
        }
      }

      // Clear the updates after processing
      dynamicFieldUpdates.clear();
    }
  });

  // Get translations
  const { t } = useTranslations();

  // Create base field props for any field type
  const createBaseFieldProps = (field: AnyFieldDefinition<TFieldValues>) => {
    const fieldRegistration = form.register(field.name);
    return {
      name: fieldRegistration.name,
      onBlur: fieldRegistration.onBlur,
      onChange: (value: unknown) =>
        form.setValue(field.name, value as TFieldValues[Path<TFieldValues>]),
      ref: fieldRegistration.ref,
      value: form.getValues(field.name),
    };
  };

  // Helper functions to convert values by type
  const convertToBoolean = (
    value: unknown
  ): { convertedValue: boolean; needsConversion: boolean } => {
    if (typeof value === 'boolean') {
      return { convertedValue: value, needsConversion: false };
    }

    if (typeof value === 'string') {
      const stringValue = String(value).toLowerCase();
      return {
        convertedValue: stringValue === 'true' || stringValue === '1',
        needsConversion: true,
      };
    }

    if (typeof value === 'number') {
      return {
        convertedValue: value !== 0,
        needsConversion: true,
      };
    }

    return { convertedValue: Boolean(value), needsConversion: true };
  };

  const convertToNumber = (
    value: unknown
  ): { convertedValue: number; needsConversion: boolean } => {
    if (typeof value === 'number') {
      return { convertedValue: value, needsConversion: false };
    }

    if (typeof value === 'string' && !Number.isNaN(Number(value))) {
      return {
        convertedValue: Number(value),
        needsConversion: true,
      };
    }

    return { convertedValue: value as number, needsConversion: false };
  };

  const convertToJson = (
    value: unknown
  ): { convertedValue: string; needsConversion: boolean } => {
    if (typeof value === 'object' && value !== null) {
      try {
        return {
          convertedValue: JSON.stringify(value, null, 2),
          needsConversion: true,
        };
      } catch (_e) {
        // Ignore JSON conversion errors
      }
    }

    return { convertedValue: value as string, needsConversion: false };
  };

  const convertToString = (
    value: unknown
  ): { convertedValue: string; needsConversion: boolean } => {
    if (typeof value === 'string') {
      return { convertedValue: value, needsConversion: false };
    }

    try {
      return {
        convertedValue: String(value),
        needsConversion: true,
      };
    } catch (_e) {
      return { convertedValue: value as string, needsConversion: false };
    }
  };

  // Helper function to convert value based on type
  const convertValueByType = (
    value: unknown,
    transformedType: string
  ): { convertedValue: unknown; needsConversion: boolean } => {
    switch (transformedType) {
      case 'boolean':
        return convertToBoolean(value);
      case 'number':
        return convertToNumber(value);
      case 'json':
        return convertToJson(value);
      case 'string':
        return convertToString(value);
      default:
        return { convertedValue: value, needsConversion: false };
    }
  };

  // Helper function to process value conversion for dynamic fields
  const processDynamicFieldValue = (
    dynamicFieldValue: unknown,
    transformedType: string,
    field: AnyFieldDefinition<TFieldValues>
  ) => {
    // We'll use a ref to record if value needs update,
    // and let the useEffect at the component level handle it
    const windowWithUpdates = window as WindowWithDynamicUpdates;
    if (!windowWithUpdates.__dynamicFieldUpdates) {
      windowWithUpdates.__dynamicFieldUpdates = new Map();
    }

    // Skip value conversion during render to avoid React errors
    // Store the needed conversion in a global map that will be processed by a useEffect
    if (dynamicFieldValue !== undefined) {
      const { convertedValue, needsConversion } = convertValueByType(
        dynamicFieldValue,
        transformedType
      );

      // Record conversion for later processing by useEffect
      if (needsConversion) {
        windowWithUpdates.__dynamicFieldUpdates?.set(field.name as string, {
          name: field.name as string,
          value: convertedValue,
        });
      }
    }
  };

  // Render dynamic-value field type
  const renderDynamicValueField = (field: AnyFieldDefinition<TFieldValues>) => {
    // Directly watch the field value for real-time updates
    const valueType = form.watch(field.dependsOn?.field as Path<TFieldValues>);
    const transformedType = field.dependsOn?.transform(valueType);

    // Get current value for this field
    const dynamicFieldValue = form.getValues(field.name);

    if (DEBUG) {
      // DEBUG: Processing dynamic field value
    }

    if (
      !transformedType ||
      typeof transformedType !== 'string' ||
      !['boolean', 'json', 'number', 'string'].includes(transformedType)
    ) {
      return null;
    }

    // Process value conversion
    processDynamicFieldValue(dynamicFieldValue, transformedType, field);

    if (DEBUG) {
      // DEBUG: Field conversion completed
    }

    // Return the dynamic field with the computed type
    return (
      <DynamicValueField
        field={field}
        form={form as UseFormReturn<Record<string, unknown>>}
        type={transformedType as 'boolean' | 'json' | 'number' | 'string'}
      />
    );
  };

  // Render a field based on its type
  const renderField = (field: AnyFieldDefinition<TFieldValues>) => {
    // Create base field props
    const baseFieldProps = createBaseFieldProps(field);

    switch (field.type) {
      case 'checkbox':
        return (
          <CheckboxField field={{ ...field, ...baseFieldProps }} form={form} />
        );
      case 'custom':
        return field.renderField({ field: baseFieldProps, form });
      case 'dynamic-value':
        return renderDynamicValueField(field);
      case 'number':
        return (
          <NumberField
            field={{ ...field, ...baseFieldProps }}
            form={form as UseFormReturn<Record<string, unknown>>}
          />
        );
      case 'select':
        return (
          <SelectField field={{ ...field, ...baseFieldProps }} form={form} />
        );
      case 'select-with-add-new':
        return (
          <SelectWithAddNewField
            field={{ ...field, ...baseFieldProps }}
            form={form as UseFormReturn<Record<string, unknown>>}
            items={field.options?.map((option) => String(option.value)) || []}
            label={field.label}
            name={field.name.toString()}
            optionsLoader={field.optionsLoader}
            placeholder={field.placeholder}
          />
        );
      case 'switch':
        return (
          <SwitchField
            field={{
              ...field,
              ...baseFieldProps,
              type: 'checkbox',
              variant: 'switch',
            }}
            form={form as UseFormReturn<Record<string, unknown>>}
          />
        );
      case 'text':
        if (typeof field === 'object' && field !== null) {
          return (
            <TextField
              field={{ ...field, ...baseFieldProps }}
              form={form as UseFormReturn<Record<string, unknown>>}
            />
          );
        }
        return null;
      case 'textarea':
        return (
          <TextareaField
            field={{ ...field, ...baseFieldProps }}
            form={form as UseFormReturn<Record<string, unknown>>}
          />
        );
      case 'value-type':
        return (
          <ValueTypeField
            description={field.description}
            field={baseFieldProps}
            form={form as UseFormReturn<Record<string, unknown>>}
            label={field.label}
            placeholder={field.placeholder}
            valueType={form.getValues(field.valueTypeField)}
          />
        );
      default: {
        const _unknownField = field as { type: string };
        return null;
      }
    }
  };

  return (
    <Form {...form}>
      <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.name.toString()}>{renderField(field)}</div>
          ))}
        </div>

        {submitText !== null && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-4">{actions}</div>
            {submitText && (
              <Button disabled={disabled || isSubmitting} type="submit">
                {t(submitText)}
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  );
}
