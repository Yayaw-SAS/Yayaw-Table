import type { ReactNode } from "react";
import type { TableActions } from "../providers/table-provider";
import type { Row } from "../tanstack";
import type { ViewConfig } from "../utils/view-config";

export type ToolbarActionVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive";

export type ToolbarActionsPlacement =
  | "before-create"
  | "between-create-export"
  | "after-export";

export interface ToolbarActionContext {
  actionsAsIcons: boolean;
  /**
   * The view the table shows now, as a saved view's `config` (the shape
   * `sanitizeViewConfig` accepts; what `onViewConfigChange` reports).
   */
  getViewConfig: () => ViewConfig;
  hasListAction: boolean;
  isCreateEnabled: boolean;
  isExportEnabled: boolean;
  isExporting: boolean;
  isFooterCalculationsEnabled: boolean;
  isMobile: boolean;
  selectedCount: number;
  selectedOriginalRows: Record<string, unknown>[];
  selectedRowIds: string[];
  selectedRows: Row<Record<string, unknown>>[];
  tableActions?: TableActions;
  tableId: string;
  tableType?: string;
}

export interface ToolbarAction {
  disabled?: boolean | ((ctx: ToolbarActionContext) => boolean);
  icon?: ReactNode;
  id: string;
  label: string;
  loading?: boolean;
  onClick: (ctx: ToolbarActionContext) => void | Promise<void>;
  requiresFooterCalculations?: boolean;
  showInIconMode?: boolean;
  tooltip?: string;
  variant?: ToolbarActionVariant;
}

export type ToolbarActionsInput =
  | ToolbarAction[]
  | ((ctx: ToolbarActionContext) => ToolbarAction[]);
