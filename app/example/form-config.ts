import { ProductSchema } from './types';

// Configuration des formulaires
export const getFormConfig = (formType: string): unknown => {
  if (formType === 'products') {
    return {
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
  }
  return;
};
