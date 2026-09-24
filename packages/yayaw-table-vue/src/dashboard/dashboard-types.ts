import type { TableActions, TableConfig, TableView } from "../types";
import type { DashboardLabelKey } from "./dashboard-model";

/** A table the dashboard can show: its config, actions and saved views. */
export interface DashboardTableSource {
  config: TableConfig;
  actions: TableActions;
  views?: TableView[];
  /** Name in pickers and titles; the config's title by default. */
  name?: string;
}

export type DashboardLabel = (
  key: DashboardLabelKey,
  params?: Record<string, number | string>
) => string;
