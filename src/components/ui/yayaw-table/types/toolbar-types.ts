import type { ReactNode } from "react";
import type { TableActions } from "../providers/table-provider";

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
  isMobile: boolean;
  tableActions?: TableActions;
  tableId: string;
}

export interface ToolbarAction {
  disabled?: boolean | ((ctx: ToolbarActionContext) => boolean);
  icon?: ReactNode;
  id: string;
  label: string;
  loading?: boolean;
  onClick: () => void | Promise<void>;
  showInIconMode?: boolean;
  tooltip?: string;
  variant?: ToolbarActionVariant;
}

export type ToolbarActionsInput =
  | ToolbarAction[]
  | ((ctx: ToolbarActionContext) => ToolbarAction[]);
