import {
  CalendarDays,
  ChartColumnBig,
  ChartGantt,
  ClipboardList,
  Columns3,
  FolderTree,
  Images,
  List,
  MapIcon,
  Newspaper,
  Table2,
} from "lucide-vue-next";
import type { Component } from "vue";
import type { TableDisplayMode } from "../../types";

export const displayModeIcons: Record<TableDisplayMode, Component> = {
  calendar: CalendarDays,
  chart: ChartColumnBig,
  feed: Newspaper,
  filetree: FolderTree,
  form: ClipboardList,
  gantt: ChartGantt,
  table: Table2,
  kanban: Columns3,
  gallery: Images,
  list: List,
  map: MapIcon,
};
