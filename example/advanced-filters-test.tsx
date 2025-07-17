/**
 * Test des filtres avancés - Debug mode
 */
'use client';

import { DataTable } from '../src/data-table/components/data-table';

// Données de test
const _testData = [
  {
    id: '1',
    name: 'MacBook Pro',
    category: 'Electronics',
    price: 2999,
    stock: 15,
    status: 'Active',
    lastUpdated: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'Wireless Mouse',
    category: 'Accessories',
    price: 59,
    stock: 100,
    status: 'Active',
    lastUpdated: '2024-01-14T09:15:00Z',
  },
  {
    id: '3',
    name: 'Monitor 4K',
    category: 'Electronics',
    price: 899,
    stock: 0,
    status: 'Out of Stock',
    lastUpdated: '2024-01-13T14:20:00Z',
  },
];

export function AdvancedFiltersTest() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-bold text-2xl">Test des Filtres Avancés</h1>
        <p className="text-muted-foreground">
          Debug des filtres activé - check console
        </p>
      </div>

      <DataTable
        description="Test des filtres avancés avec données mockées"
        enableToolbar={true}
        tableType="products"
        title="Produits"
      />
    </div>
  );
}

export default AdvancedFiltersTest;
