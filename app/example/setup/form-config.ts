import type { FieldValues } from 'react-hook-form';
import type { FormConfig } from '../../../src/data-table/components/forms/types';
import { createBulkEditFormConfig } from '../../../src/data-table/hooks/use-bulk-edit';
import { ProductSchema } from './types';

// Configuration de base pour les produits
const baseProductConfig = {
  id: 'products',
  schema: ProductSchema,
  defaultValues: {
    name: '',
    price: 0,
    status: 'In Stock' as const,
    category: '',
    brand: '',
    isActive: true,
  },
  fields: [
    {
      type: 'text',
      name: 'name',
      label: 'Product Name',
      placeholder: 'Enter product name',
      required: true,
    },
    {
      type: 'number',
      name: 'price',
      label: 'Price',
      placeholder: 'Enter price',
      required: true,
      min: 0,
    },
    {
      type: 'select',
      name: 'status',
      label: 'Status',
      required: true,
      options: [
        { value: 'In Stock', label: 'In Stock' },
        { value: 'Low Stock', label: 'Low Stock' },
        { value: 'Out of Stock', label: 'Out of Stock' },
      ],
    },
    {
      type: 'text',
      name: 'category',
      label: 'Category',
      placeholder: 'Enter category',
      required: true,
    },
    {
      type: 'text',
      name: 'brand',
      label: 'Brand',
      placeholder: 'Enter brand',
      required: true,
    },
    {
      type: 'checkbox',
      name: 'isActive',
      label: 'Active',
    },
  ],
  translations: {
    namespace: 'products',
    keys: {
      'createForm.title': 'Add New Product',
      'createForm.description': 'Create a new product in your inventory',
      'updateForm.title': 'Edit Product',
      'updateForm.description': 'Update product information',
      submit: 'Save Product',
      create: 'Add Product',
      update: 'Update Product',
      cancel: 'Cancel',
      success: 'Product saved successfully',
      error: 'Failed to save product',
      creating: 'Creating product...',
      updating: 'Updating product...',
    },
  },
};

// Configuration des formulaires
export const getFormConfig = <TFieldValues extends FieldValues = FieldValues>(
  formType: string
): FormConfig<TFieldValues> | undefined => {
  if (formType === 'products') {
    return baseProductConfig as unknown as FormConfig<TFieldValues>;
  }

  // Configuration pour l'édition en masse des produits
  if (formType === 'products-bulk') {
    return createBulkEditFormConfig(baseProductConfig, {
      title: 'Bulk Edit Products',
      description:
        'Edit multiple products at once. Only filled fields will be applied to all selected items. Unique fields like SKU or product codes are excluded to prevent conflicts.',
      excludeFields: ['id', '_id', 'createdAt', 'updatedAt'],
      uniqueFields: ['sku', 'productCode'], // Empêche l'édition en masse des champs uniques
    }) as unknown as FormConfig<TFieldValues>;
  }

  return;
};
