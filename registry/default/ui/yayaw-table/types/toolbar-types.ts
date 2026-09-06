import type { ReactNode } from "react";
import type { TableActions } from "../providers/table-provider";
import type { Row } from "../tanstack";

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
