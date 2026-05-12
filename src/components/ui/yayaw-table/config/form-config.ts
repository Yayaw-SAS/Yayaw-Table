/**
 * Form configuration for data tables
 * This file defines the types for form configuration in data tables
 */

/**
 * Form configuration for a data table
 */
export interface CatalogueFormLayoutConfig {
  /**
   * How the catalogue form should be presented.
   * The default is "drawer" to preserve the existing behavior.
   */
  mode?: "drawer" | "modal";

  /**
   * Responsive desktop width for the form surface.
   * Mobile viewports remain constrained by the dialog/drawer container.
   *
   * @example "80vw"
   * @example "48rem"
   */
  width?: string;
}

/**
 * Form configuration for a data table
 */
export interface TableFormConfig {
  /**
   * Form type for the create form
   * This should correspond to a key in the form catalogue
   */
  createFormType?: string;

  /**
   * Form type for the edit form
   * This should correspond to a key in the form catalogue
   */
  editFormType?: string;

  /**
   * Resolve the edit form type from the row being edited.
   * Useful when a single table renders rows from several business models.
   */
  resolveEditFormType?: (row: Record<string, unknown>) => string | undefined;

  /**
   * Whether to enable the create form
   * If true, a create button will be shown in the table toolbar
   */
  enableCreateForm?: boolean;

  /**
   * Whether to enable the edit form
   * If true, an edit button will be shown in the row actions
   */
  enableEditForm?: boolean;

  /**
   * Presentation options for the built-in catalogue form.
   * Omit this to keep the default right-side drawer.
   */
  layout?: CatalogueFormLayoutConfig;

  /**
   * Translation keys for form-related text
   */
  translations?: {
    /**
     * Translation key for the create button text
     */
    createButtonText?: string;

    /**
     * Translation key for the edit button text
     */
    editButtonText?: string;
  };
}
