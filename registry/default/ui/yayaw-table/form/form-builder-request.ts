import { atom } from "jotai";
import { atomFamily } from "jotai-family";

/**
 * "Edit form" in View settings asks the table's Form view to open its form
 * builder (the settings menu closes first): a counter of requests, per table
 * and per table instance (each instance has its own store).
 */
export const formBuilderRequestAtom = atomFamily((_tableId: string) => atom(0));
