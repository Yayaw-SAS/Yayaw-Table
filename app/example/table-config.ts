import { productActions } from './data'

// Configuration du tableau
export const getTableConfig = (tableType: string): any => {
    if (tableType === 'products') {
        return {
            table: {
                enableRowSelection: true,
                enableColumnFilters: true,
                enableSorting: true,
                enableColumnDragDropByDefault: false,
                manualFiltering: false,
                manualPagination: false,
                manualSorting: false,
                defaultPageSize: 10,
                enablePagination: true
            },
            columns: {
                definitions: [
                    {
                        id: 'name',
                        type: 'text',
                        header: 'Product Name',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        placeholder: 'Search products...',
                        description: 'Search by product name'
                    },
                    {
                        id: 'brand',
                        type: 'text',
                        header: 'Brand',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        placeholder: 'Search brands...',
                        description: 'Filter by brand name'
                    },
                    {
                        id: 'category',
                        type: 'tag',
                        header: 'Category',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        options: [
                            { value: 'Laptops', label: 'Laptops' },
                            { value: 'Phones', label: 'Phones' },
                            { value: 'Tablets', label: 'Tablets' },
                            { value: 'Accessories', label: 'Accessories' }
                        ],
                        placeholder: 'Select category...',
                        description: 'Filter by product category'
                    },
                    {
                        id: 'price',
                        type: 'number',
                        header: 'Price',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        min: 0,
                        max: 5000,
                        placeholder: 'Enter price...',
                        description: 'Filter by price range'
                    },
                    {
                        id: 'status',
                        type: 'tag',
                        header: 'Status',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        options: [
                            { value: 'In Stock', label: 'In Stock' },
                            { value: 'Low Stock', label: 'Low Stock' },
                            { value: 'Out of Stock', label: 'Out of Stock' }
                        ],
                        placeholder: 'Select status...',
                        description: 'Filter by stock status'
                    },
                    {
                        id: 'createdAt',
                        type: 'date',
                        header: 'Created',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        placeholder: 'Select date...',
                        description: 'Filter by creation date'
                    },
                    {
                        id: 'isActive',
                        type: 'boolean',
                        header: 'Active',
                        enableSorting: true,
                        enableColumnFilter: true,
                        canFilter: true,
                        canSort: true,
                        canHide: true,
                        options: [
                            { value: true, label: 'Active' },
                            { value: false, label: 'Inactive' }
                        ],
                        placeholder: 'Select status...',
                        description: 'Filter by active status'
                    }
                ],
                order: [
                    'select',
                    'name',
                    'brand',
                    'category',
                    'price',
                    'status',
                    'createdAt',
                    'isActive',
                    'actions'
                ],
                visible: [
                    'select',
                    'name',
                    'brand',
                    'category',
                    'price',
                    'status',
                    'createdAt',
                    'isActive',
                    'actions'
                ],
                mandatory: ['name', 'price'],
                sort: [{ id: 'createdAt', desc: true }] // Default sort by newest first
            },
            // Enhanced filter configuration
            filters: {
                // Column-specific filter configurations
                columnConfigs: {
                    name: {
                        type: 'text',
                        operators: ['contains', 'equals', 'startsWith', 'endsWith'],
                        placeholder: 'Search products...',
                        filterable: true
                    },
                    brand: {
                        type: 'text',
                        operators: ['contains', 'equals', 'startsWith'],
                        placeholder: 'Search brands...',
                        filterable: true
                    },
                    category: {
                        type: 'option',
                        operators: ['is', 'isAnyOf', 'isNot'],
                        options: [
                            { value: 'Laptops', label: 'Laptops' },
                            { value: 'Phones', label: 'Phones' },
                            { value: 'Tablets', label: 'Tablets' },
                            { value: 'Accessories', label: 'Accessories' }
                        ],
                        filterable: true,
                        faceted: true
                    },
                    price: {
                        type: 'number',
                        operators: ['equals', 'greaterThan', 'lessThan', 'between'],
                        min: 0,
                        max: 5000,
                        placeholder: 'Enter price...',
                        filterable: true
                    },
                    status: {
                        type: 'option',
                        operators: ['is', 'isAnyOf', 'isNot'],
                        options: [
                            { value: 'In Stock', label: 'In Stock' },
                            { value: 'Low Stock', label: 'Low Stock' },
                            { value: 'Out of Stock', label: 'Out of Stock' }
                        ],
                        filterable: true,
                        faceted: true
                    },
                    createdAt: {
                        type: 'date',
                        operators: ['equals', 'before', 'after', 'between'],
                        placeholder: 'Select date...',
                        filterable: true
                    },
                    isActive: {
                        type: 'option',
                        operators: ['is'],
                        options: [
                            { value: true, label: 'Active' },
                            { value: false, label: 'Inactive' }
                        ],
                        filterable: true
                    }
                }
            },
            translations: {
                namespace: 'products',
                keys: {
                    'Product Name': 'Product Name',
                    Brand: 'Brand',
                    Category: 'Category',
                    Price: 'Price',
                    Status: 'Status',
                    Created: 'Created',
                    Active: 'Active',
                    title: 'Products Table',
                    description: 'Manage your products'
                }
            }
        }
    }
    return
}

// Configuration des actions du tableau
export const getTableActions = (tableType: string) => {
    if (tableType === 'products') {
        return productActions
    }
    return
}
