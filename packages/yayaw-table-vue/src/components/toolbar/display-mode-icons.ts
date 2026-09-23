import {
  CalendarDays,
  ChartGantt,
  ClipboardList,
  Columns3,
  Images,
  List,
  Table2,
} from "lucide-vue-next";
import type { Component } from "vue";
import type { TableDisplayMode } from "../../types";

export const displayModeIcons: Record<TableDisplayMode, Component> = {
  calendar: CalendarDays,
  form: ClipboardList,
  gantt: ChartGantt,
  table: Table2,
  kanban: Columns3,
  gallery: Images,
  list: List,
};
