/**
 * Form configuration for data tables
 * This file defines the types for form configuration in data tables
 */

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
