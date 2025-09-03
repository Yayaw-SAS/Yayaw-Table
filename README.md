# 🚀 YaYaw Table

**API ultra-simple pour créer des data tables React avec zéro boilerplate !**

Une config, un composant, c'est tout. Built on @tanstack/react-table avec TypeScript.

## ✨ Features

- ⚡ **API Ultra-Simple**: Une config, un composant, zéro providers
- 🎛️ **5 Column Types**: text, tag, number, boolean, date avec icônes automatiques
- 📊 **Grouping Natif**: Expand/collapse automatique par type de colonne
- 🔄 **Pagination Sans Bugs**: Pas de Select problématique, stable
- 🚀 **TanStack Table Pur**: Performance optimale
- 📱 **Mobile Responsive**: Fonctionne sur tous les écrans
- 🎨 **Tailwind CSS**: Styling moderne
- ⚡ **TypeScript**: Type safety complète
- 🔧 **SSR-Friendly**: Pas d'erreurs d'hydration

## 🚀 Quick Start

### 1. Installation
```bash
npm install yayaw-table
# ou
bun add yayaw-table
```

### 2. Usage Ultra-Simple
```tsx
import { UltraSimpleTable } from 'yayaw-table';

const config = {
  id: 'products',
  name: 'Products Management',
  description: 'Table ultra-simple avec toutes les fonctionnalités',
  
  columns: [
    { id: 'name', type: 'text', header: 'Product Name' },
    { id: 'brand', type: 'tag', header: 'Brand' },
    { id: 'price', type: 'number', header: 'Price' },
    { id: 'status', type: 'tag', header: 'Status' },
  ],
  
  fetchData: async (params) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    const result = await response.json();
    
    return {
      data: result.data,
      pageCount: result.pageCount,
      totalCount: result.totalCount,
    };
  }
};

export const MyTable = () => (
  <UltraSimpleTable config={config} />
);
```

**C'est tout !** 🎉

## ✅ Avantages vs autres librairies

| Feature | YaYaw Table | Autres |
|---------|-------------|---------|
| **Setup** | 1 config | 5-10 fichiers |
| **Providers** | 0 | 2-3 providers |
| **Boilerplate** | 5 lignes | 50-100 lignes |
| **Boucles infinies** | ❌ Jamais | ✅ Souvent |
| **Types** | ✅ Auto | ⚠️ Manuel |
| **Grouping** | ✅ Natif | ⚠️ Complexe |
| **SSR** | ✅ Stable | ⚠️ Problématique |

## 🔧 Fonctionnalités

### Grouping Automatique
- Boutons "Group by Brand", "Group by Category" générés automatiquement
- Expand/collapse des groupes avec compteurs
- Icônes par type de colonne dans les headers

### Types de Colonnes
```tsx
{ id: 'name', type: 'text', header: 'Name' }        // 📝 Icône Text
{ id: 'brand', type: 'tag', header: 'Brand' }       // 🏷️ Icône Tag  
{ id: 'price', type: 'number', header: 'Price' }    // # Icône Hash
{ id: 'active', type: 'boolean', header: 'Active' } // ⚡ Icône Toggle
{ id: 'date', type: 'date', header: 'Created' }     // 📅 Icône Calendar
```

### Pagination Stable
- Navigation Previous/Next sans bugs
- Compteurs automatiques ("Showing 1 to 10 of 100")
- **Pas de Select Radix problématique**

### Performance
- TanStack Table pur - 0 abstraction inutile
- Pas de providers complexes
- SSR-friendly sans erreurs d'hydration

## 📖 Documentation

- [Installation](./content/docs/installation.mdx)
- [Ultra Simple API](./content/docs/ultra-simple-api.mdx)
- [Exemple complet](./app/example/page.tsx)

## 🎯 Migration depuis l'ancienne API

### ❌ Avant (95 lignes de boilerplate)
```tsx
<TableProvider getTableConfig={...} getColumnsConfig={...}>
  <DataTableUIProvider columnsConfig={...} tableConfig={...}>
    <DataTable tableType="products" columnTypeMapping={{...}} />
  </DataTableUIProvider>
</TableProvider>
```

### ✅ Après (5 lignes)
```tsx
<UltraSimpleTable config={config} />
```

**95% moins de code !**

## 🔗 Exemples

- **Live Demo**: [http://localhost:3001/example](http://localhost:3001/example)
- **Code Source**: [./app/example/page.tsx](./app/example/page.tsx)

## 🤝 Contributing

```bash
git clone https://github.com/your-org/yayaw-table
cd yayaw-table
bun install
bun run dev
```

## 📝 License

MIT