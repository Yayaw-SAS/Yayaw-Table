import type { FieldValues } from "react-hook-form";
import type { FormConfig } from "@/src/components/ui/yayaw-table/components/forms/types";
import { createBulkEditFormConfig } from "@/src/components/ui/yayaw-table/hooks/use-bulk-edit";
import type { AppLocale } from "@/src/i18n/routing";
import { ProductSchema } from "./types";

const FORM_COPY: Record<
  AppLocale,
  {
    bulkDescription: string;
    bulkTitle: string;
    bulkTranslations: {
      update: string;
      updated: string;
      updateError: string;
      updating: string;
    };
    fields: {
      active: string;
      brand: string;
      brandPlaceholder: string;
      category: string;
      categoryPlaceholder: string;
      name: string;
      namePlaceholder: string;
      price: string;
      pricePlaceholder: string;
      status: string;
    };
    productStatusLabels: {
      inStock: string;
      lowStock: string;
      outOfStock: string;
    };
    translations: Record<string, string>;
  }
> = {
  en: {
    bulkDescription:
      "Edit multiple products at once. Only filled fields will be applied to all selected items. Unique fields like SKU or product codes are excluded to prevent conflicts.",
    bulkTitle: "Bulk Edit Products",
    bulkTranslations: {
      update: "Update selected items",
      updated: "Items updated successfully",
      updateError: "Failed to update items",
      updating: "Updating items...",
    },
    fields: {
      active: "Active",
      brand: "Brand",
      brandPlaceholder: "Enter brand",
      category: "Category",
      categoryPlaceholder: "Enter category",
      name: "Product Name",
      namePlaceholder: "Enter product name",
      price: "Price",
      pricePlaceholder: "Enter price",
      status: "Status",
    },
    productStatusLabels: {
      inStock: "In Stock",
      lowStock: "Low Stock",
      outOfStock: "Out of Stock",
    },
    translations: {
      created: "Product created successfully",
      createError: "Failed to create product",
      "createForm.description": "Create a new product in your inventory",
      "createForm.title": "Add New Product",
      updated: "Product updated successfully",
      updateError: "Failed to update product",
      "updateForm.description": "Update product information",
      "updateForm.title": "Edit Product",
      cancel: "Cancel",
      create: "Add Product",
      creating: "Creating product...",
      error: "Failed to save product",
      submit: "Save Product",
      success: "Product saved successfully",
      update: "Update Product",
      updating: "Updating product...",
    },
  },
  fr: {
    bulkDescription:
      "Modifiez plusieurs produits en une fois. Seuls les champs remplis seront appliqués aux éléments sélectionnés. Les champs uniques comme SKU ou code produit sont exclus pour éviter les conflits.",
    bulkTitle: "Édition en masse des produits",
    bulkTranslations: {
      update: "Mettre à jour les éléments sélectionnés",
      updated: "Éléments mis à jour avec succès",
      updateError: "Échec de la mise à jour des éléments",
      updating: "Mise à jour des éléments...",
    },
    fields: {
      active: "Actif",
      brand: "Marque",
      brandPlaceholder: "Saisir la marque",
      category: "Catégorie",
      categoryPlaceholder: "Saisir la catégorie",
      name: "Nom du produit",
      namePlaceholder: "Saisir le nom du produit",
      price: "Prix",
      pricePlaceholder: "Saisir le prix",
      status: "Statut",
    },
    productStatusLabels: {
      inStock: "En stock",
      lowStock: "Stock faible",
      outOfStock: "Rupture de stock",
    },
    translations: {
      created: "Produit créé avec succès",
      createError: "Échec de la création du produit",
      "createForm.description":
        "Créez un nouveau produit dans votre inventaire",
      "createForm.title": "Ajouter un produit",
      updated: "Produit mis à jour avec succès",
      updateError: "Échec de la mise à jour du produit",
      "updateForm.description": "Mettre à jour les informations du produit",
      "updateForm.title": "Modifier le produit",
      cancel: "Annuler",
      create: "Ajouter le produit",
      creating: "Création du produit...",
      error: "Impossible d'enregistrer le produit",
      submit: "Enregistrer le produit",
      success: "Produit enregistré avec succès",
      update: "Mettre à jour le produit",
      updating: "Mise à jour du produit...",
    },
  },
};

const createBaseProductConfig = (locale: AppLocale) => {
  const copy = FORM_COPY[locale] ?? FORM_COPY.en;

  return {
    id: "products",
    schema: ProductSchema,
    defaultValues: {
      name: "",
      price: 0,
      status: "In Stock" as const,
      category: "",
      brand: "",
      website: "",
      isActive: true,
    },
    fields: [
      {
        type: "text",
        name: "name",
        label: copy.fields.name,
        placeholder: copy.fields.namePlaceholder,
        required: true,
      },
      {
        type: "number",
        name: "price",
        label: copy.fields.price,
        placeholder: copy.fields.pricePlaceholder,
        required: true,
        min: 0,
      },
      {
        type: "select",
        name: "status",
        label: copy.fields.status,
        required: true,
        options: [
          { value: "In Stock", label: copy.productStatusLabels.inStock },
          { value: "Low Stock", label: copy.productStatusLabels.lowStock },
          { value: "Out of Stock", label: copy.productStatusLabels.outOfStock },
        ],
      },
      {
        type: "text",
        name: "category",
        label: copy.fields.category,
        placeholder: copy.fields.categoryPlaceholder,
        required: true,
      },
      {
        type: "text",
        name: "brand",
        label: copy.fields.brand,
        placeholder: copy.fields.brandPlaceholder,
        required: true,
      },
      {
        type: "url",
        name: "website",
        label: locale === "fr" ? "Site web" : "Website",
        placeholder: "https://www.example.com",
        showMetaPreview: true,
      },
      {
        type: "switch",
        name: "isActive",
        label: copy.fields.active,
      },
    ],
    translations: {
      namespace: "products",
      keys: copy.translations,
    },
  };
};

export const getFormConfig = <TFieldValues extends FieldValues = FieldValues>(
  formType: string,
  locale: AppLocale = "en"
): FormConfig<TFieldValues> | undefined => {
  const baseProductConfig = createBaseProductConfig(locale);
  const copy = FORM_COPY[locale] ?? FORM_COPY.en;

  if (formType === "products") {
    return baseProductConfig as unknown as FormConfig<TFieldValues>;
  }

  if (formType === "products-bulk") {
    const bulkConfig = createBulkEditFormConfig(baseProductConfig, {
      title: FORM_COPY[locale]?.bulkTitle ?? FORM_COPY.en.bulkTitle,
      description:
        FORM_COPY[locale]?.bulkDescription ?? FORM_COPY.en.bulkDescription,
      excludeFields: ["id", "_id", "createdAt", "updatedAt"],
      // Protect unique fields from mass edits.
      uniqueFields: ["sku", "productCode"],
    }) as unknown as FormConfig<TFieldValues>;

    return {
      ...bulkConfig,
      translations: {
        ...bulkConfig.translations,
        keys: {
          ...bulkConfig.translations.keys,
          update: copy.bulkTranslations.update,
          updated: copy.bulkTranslations.updated,
          updateError: copy.bulkTranslations.updateError,
          updating: copy.bulkTranslations.updating,
        },
      },
    };
  }

  return;
};
