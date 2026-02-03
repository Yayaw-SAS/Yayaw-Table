/**
 * Atoms for the catalogue form
 * These atoms manage the state of the catalogue form drawer
 */
import { atom } from "jotai";

/**
 * Interface for the catalogue form state
 */
export interface CatalogueFormState<TData = Record<string, unknown>> {
  /**
   * Type of form to use (corresponds to a key in the form catalogue)
   */
  formType?: string;

  /**
   * Initial data for the form (used for update operations)
   */
  initialData?: TData;

  /**
   * Whether the form drawer is open
   */
  isOpen: boolean;

  /**
   * Mode of the form (create or update)
   */
  mode: "create" | "update";

  /**
   * Callback when the form is submitted successfully
   */
  onSuccess?: (data: TData) => void;

  /**
   * Table ID associated with the form
   */
  tableId?: string;
}

/**
 * Default state for the catalogue form
 */
const defaultState: CatalogueFormState = {
  formType: undefined,
  initialData: undefined,
  isOpen: false,
  mode: "create",
  onSuccess: undefined,
  tableId: undefined,
};

/**
 * Atom for the catalogue form state
 */
export const catalogueFormAtom = atom<CatalogueFormState>(defaultState);

/**
 * Atom to track whether a form has been submitted
 * This prevents showing success notifications except after actual form submission
 */
export const formSubmittedAtom = atom<boolean>(false);

/**
 * Form renderer components
 */
export const FormRenderer = {
  CONTAINER: "container",
  NONE: "none",
  TOOLBAR: "toolbar",
} as const;

export type FormRenderer = (typeof FormRenderer)[keyof typeof FormRenderer];

/**
 * Atom to track which component is responsible for rendering the form
 * This helps prevent multiple components from rendering the same form
 */
export const formRendererAtom = atom<FormRenderer>(FormRenderer.NONE);

/**
 * Open the form in create mode
 */
export const openCreateForm = <TData = Record<string, unknown>>(
  formType: string,
  tableId: string,
  onSuccess?: (data: TData) => void
): CatalogueFormState<TData> => ({
  formType,
  initialData: undefined,
  isOpen: true,
  mode: "create",
  onSuccess,
  tableId,
});

/**
 * Open the form in update mode
 */
export const openUpdateForm = <TData = Record<string, unknown>>(
  formType: string,
  tableId: string,
  initialData: TData,
  onSuccess?: (data: TData) => void
): CatalogueFormState<TData> => ({
  formType,
  initialData,
  isOpen: true,
  mode: "update",
  onSuccess,
  tableId,
});

/**
 * Close the form
 */
export const closeForm = <
  TData = Record<string, unknown>,
>(): CatalogueFormState<TData> => ({
  formType: undefined,
  initialData: undefined,
  isOpen: false,
  mode: "create",
  onSuccess: undefined,
  tableId: undefined,
});

/**
 * Handle form open state changes
 * This function updates the form state based on the open state
 */
export const handleFormOpenChange = <TData = Record<string, unknown>>(
  open: boolean,
  currentState: CatalogueFormState<TData>
): CatalogueFormState<TData> => {
  // If the state is already what we want, return the current state to prevent unnecessary re-renders
  if (currentState.isOpen === open) {
    return currentState;
  }

  // If opening, just update the isOpen state and keep everything else
  if (open) {
    return {
      ...currentState,
      isOpen: true,
    };
  }

  // If closing, only reset the form if it was actually open
  // This prevents unnecessary state changes
  if (currentState.isOpen) {
    return {
      formType: undefined,
      initialData: undefined,
      isOpen: false,
      mode: "create",
      onSuccess: undefined,
      tableId: undefined,
    };
  }

  // Form was already closed, return current state
  return currentState;
};
