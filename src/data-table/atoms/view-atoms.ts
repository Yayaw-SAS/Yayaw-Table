'use client';

import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

import type { TableView } from '../types/view-types';

/**
 * Atom family for storing the active view ID for each table
 */
export const activeViewIdAtom = atomFamily(
  (_tableId: string) => atom<null | string>(null),
  (a, b) => a === b
);

/**
 * Atom family for storing system-defined views for each table
 */
export const systemViewsAtom = atomFamily(
  (_tableId: string) => atom<TableView[]>([]),
  (a, b) => a === b
);

/**
 * Atom family for storing user-defined views for each table
 */
export const tableViewsAtom = atomFamily(
  (_tableId: string) => atom<TableView[]>([]),
  (a, b) => a === b
);
