import { dateDay, dayDate, isWorkingDay, taskCalendar } from "./calendar";
import { normalizeGanttView, planningTree } from "./engine";
import type { PlanningSession } from "./session";
import {
  type DependencyType,
  type PlanningDependency,
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  samePlanningRef,
  type TableGanttConfig,
  type TableGanttViewConfig,
} from "./types";

export interface PlanningSurfaceOptions {
  session: PlanningSession;
  mode: "gantt" | "overlay";
  locale?: string;
  gantt?: TableGanttConfig;
  visible?: (task: PlanningTask) => boolean;
  compare?: (a: PlanningTask, b: PlanningTask) => number;
  onViewChange?: (view: TableGanttViewConfig) => void;
  onOpenRecord?: (task: PlanningTask) => void;
  emptyTitle?: string;
  onClearFilters?: () => void;
}
interface TimelineRow {
  task: PlanningTask;
  depth: number;
  hasChildren: boolean;
}
interface TimelineGeometry {
  from: number;
  labelWidth: number;
  width: number;
  count: number;
  totalWidth: number;
  columnFrom: number;
  columnTo: number;
  firstRow: number;
  lastRow: number;
}
function visibleEndpoint(
  value: { task: PlanningTask; i: number } | undefined,
  first: number,
  last: number
): value is { task: PlanningTask & { start: string; end: string }; i: number } {
  return Boolean(
    value &&
      value.i >= first &&
      value.i < last &&
      value.task.start &&
      value.task.end
  );
}
function endpointX(
  task: PlanningTask & { start: string; end: string },
  finish: boolean,
  from: number,
  width: number,
  labelWidth: number
): number {
  return (
    labelWidth +
    (dateDay(finish ? task.end : task.start) - from + (finish ? 1 : 0)) * width
  );
}
const words = {
  en: {
    planning: "Planning",
    task: "Task",
    start: "Start",
    end: "End",
    parent: "Parent",
    root: "No parent",
    source: "Table",
    predecessor: "Predecessor",
    type: "Dependency type",
    lag: "Offset",
    unit: "Count offset in",
    working: "Working days",
    calendar: "Calendar days",
    dependencies: "Dependencies",
    add: "Add dependency",
    edit: "Edit",
    remove: "Remove",
    preview: "Review changes",
    apply: "Apply all changes",
    cancel: "Cancel",
    save: "Preview changes",
    close: "Close",
    loading: "Loading planning…",
    retry: "Reload planning",
    empty: "No tasks match this view",
    clear: "Clear filters",
    unscheduled: "Not scheduled",
    before: "Before",
    after: "After",
    reason: "Reason",
    day: "Day",
    week: "Week",
    month: "Month",
    today: "Today",
    previous: "Previous period",
    next: "Next period",
    weekStart: "First day of week",
    showLinks: "Show dependencies",
    move: "Move",
    resizeStart: "Resize start",
    resizeEnd: "Resize end",
    expand: "Expand",
    collapse: "Collapse",
    noAdapter:
      "Configure table.planning and actions.planning to load this planning.",
    record: "Open record",
    newLink: "New dependency",
    requested: "Requested change",
    summary: "Summary dates",
    group: "Group or calendar adjustment",
    dependency: "Dependency",
    noDates: "—",
    relationsChanged: "Dependency changes are included in this transaction.",
  },
  fr: {
    planning: "Planification",
    task: "Élément",
    start: "Début",
    end: "Fin",
    parent: "Parent",
    root: "Sans parent",
    source: "Table",
    predecessor: "Prédécesseur",
    type: "Type de dépendance",
    lag: "Décalage",
    unit: "Compter le décalage en",
    working: "Jours ouvrés",
    calendar: "Jours calendaires",
    dependencies: "Dépendances",
    add: "Ajouter une dépendance",
    edit: "Modifier",
    remove: "Supprimer",
    preview: "Vérifier les modifications",
    apply: "Appliquer toutes les modifications",
    cancel: "Annuler",
    save: "Prévisualiser",
    close: "Fermer",
    loading: "Chargement du planning…",
    retry: "Recharger le planning",
    empty: "Aucun élément ne correspond à cette vue",
    clear: "Effacer les filtres",
    unscheduled: "Non planifié",
    before: "Avant",
    after: "Après",
    reason: "Raison",
    day: "Jour",
    week: "Semaine",
    month: "Mois",
    today: "Aujourd’hui",
    previous: "Période précédente",
    next: "Période suivante",
    weekStart: "Premier jour de la semaine",
    showLinks: "Afficher les dépendances",
    move: "Déplacer",
    resizeStart: "Modifier le début",
    resizeEnd: "Modifier la fin",
    expand: "Déplier",
    collapse: "Replier",
    noAdapter:
      "Configurer table.planning et actions.planning pour charger ce planning.",
    record: "Ouvrir la fiche",
    newLink: "Nouvelle dépendance",
    requested: "Modification demandée",
    summary: "Dates récapitulatives",
    group: "Ajustement du groupe ou calendrier",
    dependency: "Dépendance",
    noDates: "—",
    relationsChanged:
      "Les modifications des dépendances sont incluses dans cette transaction.",
  },
};
type Labels = typeof words.en;
const ROW_HEIGHT = 42;
const HEADER_HEIGHT = 64;
const LABEL_WIDTH = 270;

const ICON_PATHS = {
  previous: "m14 6-6 6 6 6",
  next: "m10 6 6 6-6 6",
  down: "m6 9 6 6 6-6",
  page: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 13h8M8 17h5",
  group: "m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5",
  reload: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3",
  close: "m6 6 12 12M6 18 18 6",
} as const;

/** The DOM renderer is shared by the two framework adapters, including keyboard and pointer behavior. */
export function mountPlanningSurface(
  container: HTMLElement,
  initial: PlanningSurfaceOptions
) {
  let options = initial;
  let view = normalizeGanttView(initial.gantt);
  let scrollTop = 0;
  let scrollLeft = 0;
  let frame: number | undefined;
  let dialog: HTMLDialogElement | undefined;
  let editingLink: string | undefined;
  let restoreFocus: HTMLElement | undefined;
  const collapsed = new Set<string>();
  const drafts = new Map<string, string>();
  let draftContext = "";
  const doc = container.ownerDocument;
  container.classList.add("yayaw-planning");
  const labels = (): Labels =>
    (options.locale?.startsWith("fr") ? words.fr : words.en) as Labels;
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
    className?: string
  ): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag);
    if (text != null) {
      element.textContent = text;
    }
    if (className) {
      element.className = className;
    }
    return element;
  };
  const icon = (name: keyof typeof ICON_PATHS): SVGSVGElement => {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("yp-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = doc.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", ICON_PATHS[name]);
    svg.append(path);
    return svg;
  };
  const button = (
    label: string,
    action: () => void,
    disabled = false,
    key?: string
  ): HTMLButtonElement => {
    const element = node("button", label);
    element.type = "button";
    element.disabled = disabled;
    element.addEventListener("click", action);
    if (key) {
      element.dataset.focus = key;
    }
    return element;
  };
  const field = (label: string, control: HTMLElement): HTMLLabelElement => {
    const element = node("label", undefined, "yp-field");
    element.append(node("span", label), control);
    return element;
  };
  const input = (
    type: string,
    value: string,
    key: string
  ): HTMLInputElement => {
    const element = node("input");
    element.type = type;
    element.value = drafts.get(key) ?? value;
    element.dataset.focus = key;
    return element;
  };
  const select = (
    entries: { value: string; label: string }[],
    value: string,
    key: string
  ): HTMLSelectElement => {
    const element = node("select");
    element.dataset.focus = key;
    for (const entry of entries) {
      const option = node("option", entry.label);
      option.value = entry.value;
      element.append(option);
    }
    element.value = drafts.get(key) ?? value;
    return element;
  };
  const errorNode = (): HTMLElement | undefined => {
    const error = options.session.getState().error;
    if (!error) {
      return;
    }
    const element = node("p", error, "yp-error");
    element.setAttribute("role", "alert");
    return element;
  };
  const changeView = (patch: TableGanttViewConfig): void => {
    view = { ...view, ...patch };
    options.onViewChange?.(view);
    render();
  };
  const showTask = (task: PlanningTask): void => {
    editingLink = undefined;
    options.session.open(task.ref);
  };

  function renderControls(): HTMLElement {
    const t = labels();
    const toolbar = node("div", undefined, "yp-toolbar");
    const anchor = (): number => dateDay(view.anchorDate ?? firstDate());
    const period = node(
      "span",
      new Intl.DateTimeFormat(options.locale ?? "en", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${dayDate(anchor())}T00:00:00Z`)),
      "yp-period"
    );
    const controls = node("div", undefined, "yp-toolbar-controls");
    const navigation = node("div", undefined, "yp-navigation");
    const zoom = select(
      ["day", "week", "month"].map((value) => ({
        value,
        label: t[value as "day"],
      })),
      view.zoom ?? "week",
      "zoom"
    );
    zoom.setAttribute("aria-label", "Zoom");
    zoom.onchange = () =>
      changeView({ zoom: zoom.value as "day" | "week" | "month" });
    const start = select(
      Array.from({ length: 7 }, (_, day) => ({
        value: String(day),
        label: new Intl.DateTimeFormat(options.locale ?? "en", {
          weekday: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2026, 0, 4 + day))),
      })),
      String(view.weekStartsOn ?? 1),
      "week-start"
    );
    start.setAttribute("aria-label", t.weekStart);
    start.title = t.weekStart;
    start.onchange = () => changeView({ weekStartsOn: Number(start.value) });
    const days = { day: 7, week: 30, month: 90 }[view.zoom ?? "week"];
    navigation.append(
      button(
        "‹",
        () => {
          scrollLeft = 0;
          changeView({ anchorDate: dayDate(anchor() - days) });
        },
        false,
        "previous"
      ),
      button(
        t.today,
        () => {
          scrollLeft = 0;
          changeView({ anchorDate: new Date().toISOString().slice(0, 10) });
        },
        false,
        "today"
      ),
      button(
        "›",
        () => {
          scrollLeft = 0;
          changeView({ anchorDate: dayDate(anchor() + days) });
        },
        false,
        "next"
      )
    );
    for (const [index, name, label] of [
      [0, "previous", t.previous],
      [2, "next", t.next],
    ] as const) {
      const control = navigation.children[index] as HTMLButtonElement;
      control.setAttribute("aria-label", label);
      control.title = label;
      control.className = "yp-icon-button";
      control.replaceChildren(icon(name));
    }
    const links = input("checkbox", "", "show-links");
    links.checked = view.showDependencies !== false;
    links.onchange = () => changeView({ showDependencies: links.checked });
    const toggle = field(t.showLinks, links);
    toggle.classList.add("yp-toggle");
    const reload = button(
      t.retry,
      () => {
        options.session.load();
      },
      options.session.getState().busy,
      "reload"
    );
    reload.setAttribute("aria-label", t.retry);
    reload.title = t.retry;
    reload.className = "yp-icon-button";
    reload.replaceChildren(icon("reload"));
    controls.append(zoom, navigation, start, toggle, reload);
    toolbar.append(period, controls);
    return toolbar;
  }
  function firstDate(): string {
    const dates = options.session
      .getState()
      .snapshot?.tasks.flatMap((task) => (task.start ? [task.start] : []))
      .sort();
    return dates?.[0] ?? new Date().toISOString().slice(0, 10);
  }
  function attachDrag(
    element: HTMLButtonElement,
    task: PlanningTask,
    operation: "move" | "start" | "end",
    dayWidth: number
  ): void {
    let origin: number | undefined;
    let moved = false;
    const change = (days: number): void => {
      if (!days) {
        return;
      }
      if (operation === "move") {
        options.session.request([{ type: "move", ref: task.ref, days }]);
      } else if (task.start && task.end) {
        options.session.request([
          {
            type: "dates",
            ref: task.ref,
            start:
              operation === "start"
                ? dayDate(dateDay(task.start) + days)
                : task.start,
            end:
              operation === "end"
                ? dayDate(dateDay(task.end) + days)
                : task.end,
          },
        ]);
      }
    };
    element.onpointerdown = (event) => {
      if (event.button !== 0 || element.disabled) {
        return;
      }
      origin = event.clientX;
      moved = false;
      element.setPointerCapture?.(event.pointerId);
    };
    element.onpointermove = (event) => {
      if (origin == null) {
        return;
      }
      const delta = Math.round((event.clientX - origin) / dayWidth);
      moved ||= delta !== 0;
      element.style.transform = `translateX(${delta * dayWidth}px)`;
    };
    element.onpointerup = (event) => {
      if (origin == null) {
        return;
      }
      const delta = Math.round((event.clientX - origin) / dayWidth);
      origin = undefined;
      element.style.transform = "";
      element.releasePointerCapture?.(event.pointerId);
      change(delta);
    };
    element.onpointercancel = () => {
      origin = undefined;
      element.style.transform = "";
    };
    element.onclick = () => {
      if (!moved) {
        showTask(task);
      }
      moved = false;
    };
    element.onkeydown = (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        change((event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 7 : 1));
      }
    };
  }
  function timelineDate(
    { from, labelWidth, width }: TimelineGeometry,
    day: number,
    format: Intl.DateTimeFormat
  ): HTMLElement {
    const cell = node("div", undefined, "yp-date");
    cell.style.left = `${labelWidth + day * width}px`;
    cell.style.width = `${width}px`;
    const date = dayDate(from + day);
    cell.title = date;
    if (date === new Date().toISOString().slice(0, 10)) {
      cell.classList.add("yp-date-today");
      cell.setAttribute("aria-current", "date");
    }
    if (view.zoom !== "month" || day % 7 === 0) {
      if (view.zoom !== "month") {
        cell.append(
          node(
            "span",
            format.format(new Date(`${date}T00:00:00Z`)),
            "yp-weekday"
          )
        );
      }
      cell.append(node("span", String(Number(date.slice(8))), "yp-day-number"));
    }
    return cell;
  }
  function timelineHeader(geometry: TimelineGeometry): HTMLElement {
    const { from, labelWidth, width, columnFrom, columnTo } = geometry;
    const t = labels();
    const header = node("div", undefined, "yp-header");
    header.style.height = `${HEADER_HEIGHT}px`;
    const name = node("div", t.task, "yp-label yp-heading");
    name.prepend(icon("page"));
    name.style.width = `${labelWidth}px`;
    header.append(name);
    const format = new Intl.DateTimeFormat(options.locale ?? "en", {
      weekday: view.zoom === "day" ? "short" : "narrow",
      timeZone: "UTC",
    });
    for (let day = columnFrom; day < columnTo; day += 1) {
      header.append(timelineDate(geometry, day, format));
    }
    let monthStart = columnFrom;
    while (monthStart < columnTo) {
      const date = dayDate(from + monthStart);
      let monthEnd = monthStart + 1;
      while (
        monthEnd < columnTo &&
        dayDate(from + monthEnd).slice(0, 7) === date.slice(0, 7)
      ) {
        monthEnd += 1;
      }
      const month = node(
        "div",
        new Intl.DateTimeFormat(options.locale ?? "en", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00Z`)),
        "yp-month"
      );
      month.style.left = `${labelWidth + monthStart * width}px`;
      month.style.width = `${(monthEnd - monthStart) * width}px`;
      header.append(month);
      monthStart = monthEnd;
    }
    return header;
  }
  function timelineBar(
    task: PlanningTask,
    hasChildren: boolean,
    snapshot: PlanningSnapshot,
    { width, count }: TimelineGeometry,
    start: number,
    end: number
  ): HTMLElement {
    const key = planningKey(task.ref);
    const t = labels();
    const state = options.session.getState();
    const bar = node(
      "div",
      undefined,
      `yp-bar${hasChildren && options.session.config.parentDates === "rollup" ? " yp-summary" : ""}`
    );
    bar.style.left = `${Math.max(0, start) * width}px`;
    bar.style.width = `${Math.max(8, (Math.min(count, end) - Math.max(0, start)) * width)}px`;
    const editable =
      options.session.canEdit(task) &&
      options.session.config.allowDateEdit &&
      !state.busy &&
      !state.preview &&
      snapshot.complete &&
      (!hasChildren ||
        options.session.config.parentDates === "independent" ||
        options.session.config.allowSummaryMove);
    const move = button(task.label, () => showTask(task), false, `bar-${key}`);
    move.setAttribute(
      "aria-label",
      `${t.move} ${task.label}: ${task.start} – ${task.end}`
    );
    move.title = `${task.label}: ${task.start} – ${task.end}`;
    move.className = "yp-bar-body";
    if (editable) {
      attachDrag(move, task, "move", width);
    }
    bar.append(move);
    if (
      editable &&
      (!hasChildren || options.session.config.parentDates === "independent")
    ) {
      for (const side of ["start", "end"] as const) {
        const handle = button(
          "",
          () => {
            /* Pointer and keyboard handlers are installed below. */
          },
          false,
          `${side}-${key}`
        );
        handle.className = `yp-handle yp-${side}`;
        handle.setAttribute(
          "aria-label",
          `${side === "start" ? t.resizeStart : t.resizeEnd} ${task.label}`
        );
        attachDrag(handle, task, side, width);
        bar.append(handle);
      }
    }
    return bar;
  }
  function timelineTrack(
    task: PlanningTask,
    hasChildren: boolean,
    snapshot: PlanningSnapshot,
    geometry: TimelineGeometry
  ): HTMLElement {
    const { from, labelWidth, width, count, columnFrom, columnTo } = geometry;
    const t = labels();
    const track = node("div", undefined, "yp-track");
    track.style.left = `${labelWidth}px`;
    track.style.width = `${count * width}px`;
    track.style.backgroundSize = `${width}px 100%`;
    try {
      const calendar = taskCalendar(task, snapshot);
      for (let day = columnFrom; day < columnTo; day += 1) {
        if (!isWorkingDay(from + day, calendar)) {
          const shade = node("span", undefined, "yp-day-off");
          shade.style.left = `${day * width}px`;
          shade.style.width = `${width}px`;
          track.append(shade);
        }
      }
    } catch {
      /* The load error explains an unavailable calendar; keep the task inspectable. */
    }
    if (task.start && task.end) {
      const start = dateDay(task.start) - from;
      const end = dateDay(task.end) - from + 1;
      if (end > 0 && start < count) {
        track.append(
          timelineBar(task, hasChildren, snapshot, geometry, start, end)
        );
      }
    } else {
      track.append(node("span", t.unscheduled, "yp-unscheduled"));
    }
    return track;
  }
  function timelineRow(
    currentRow: TimelineRow,
    i: number,
    snapshot: PlanningSnapshot,
    geometry: TimelineGeometry
  ): HTMLElement {
    const t = labels();
    const { task, depth, hasChildren } = currentRow;
    const key = planningKey(task.ref);
    const row = node(
      "div",
      undefined,
      `yp-row${hasChildren ? " yp-row-summary" : ""}`
    );
    row.style.top = `${HEADER_HEIGHT + i * ROW_HEIGHT}px`;
    row.style.height = `${ROW_HEIGHT}px`;
    row.dataset.task = key;
    const label = node("div", undefined, "yp-label");
    label.style.width = `${geometry.labelWidth}px`;
    label.style.paddingLeft = `${8 + depth * 16}px`;
    if (hasChildren) {
      const toggle = button(
        collapsed.has(key) ? "▸" : "▾",
        () => {
          if (collapsed.has(key)) {
            collapsed.delete(key);
          } else {
            collapsed.add(key);
          }
          render();
        },
        false,
        `expand-${key}`
      );
      toggle.setAttribute(
        "aria-label",
        `${collapsed.has(key) ? t.expand : t.collapse} ${task.label}`
      );
      toggle.setAttribute("aria-expanded", String(!collapsed.has(key)));
      toggle.className = "yp-tree-toggle";
      toggle.replaceChildren(icon(collapsed.has(key) ? "next" : "down"));
      label.append(toggle);
    } else {
      const spacer = node("span", undefined, "yp-tree-spacer");
      spacer.setAttribute("aria-hidden", "true");
      label.append(spacer);
    }
    const title = button(
      task.label,
      () => showTask(task),
      false,
      `task-${key}`
    );
    title.className = "yp-task-button";
    title.replaceChildren(
      icon(hasChildren ? "group" : "page"),
      node("span", task.label, "yp-task-title")
    );
    title.title = `${task.ref.source} · ${task.label}`;
    label.append(title);
    row.append(label);
    const track = timelineTrack(task, hasChildren, snapshot, geometry);
    row.append(track);
    return row;
  }
  function timelineLinks(
    rows: TimelineRow[],
    snapshot: PlanningSnapshot,
    { from, labelWidth, width, totalWidth, firstRow, lastRow }: TimelineGeometry
  ): SVGSVGElement {
    const t = labels();
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("yp-links");
    svg.setAttribute("width", String(totalWidth));
    svg.setAttribute(
      "height",
      String(HEADER_HEIGHT + rows.length * ROW_HEIGHT)
    );
    svg.setAttribute("aria-label", t.dependencies);
    svg.setAttribute("role", "img");
    const positions = new Map(
      rows.map((row, i) => [planningKey(row.task.ref), { task: row.task, i }])
    );
    for (const edge of snapshot.dependencies) {
      const a = positions.get(planningKey(edge.from));
      const b = positions.get(planningKey(edge.to));
      if (
        !(
          visibleEndpoint(a, firstRow, lastRow) &&
          visibleEndpoint(b, firstRow, lastRow)
        )
      ) {
        continue;
      }
      const ax = endpointX(
        a.task,
        edge.type[0] === "F",
        from,
        width,
        labelWidth
      );
      const bx = endpointX(
        b.task,
        edge.type[1] === "F",
        from,
        width,
        labelWidth
      );
      if (
        ax < labelWidth ||
        bx < labelWidth ||
        ax > totalWidth ||
        bx > totalWidth
      ) {
        continue;
      }
      const ay = HEADER_HEIGHT + (a.i + 0.5) * ROW_HEIGHT;
      const by = HEADER_HEIGHT + (b.i + 0.5) * ROW_HEIGHT;
      const path = doc.createElementNS(svg.namespaceURI, "path");
      const mid = Math.max(ax, bx) + 12;
      path.setAttribute(
        "d",
        `M ${ax} ${ay} H ${mid} V ${by} H ${bx} l 5 -3 m -5 3 l 5 3`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      svg.append(path);
    }
    return svg;
  }
  function visibleRows(input: PlanningSnapshot): TimelineRow[] {
    const snapshot = options.compare
      ? { ...input, tasks: [...input.tasks].sort(options.compare) }
      : input;
    const visible = options.visible
      ? new Set(
          snapshot.tasks
            .filter(options.visible)
            .map((task) => planningKey(task.ref))
        )
      : undefined;
    return options.session.config.hierarchy
      ? planningTree(snapshot, visible, collapsed)
      : snapshot.tasks
          .filter((task) => !visible || visible.has(planningKey(task.ref)))
          .map((task) => ({ task, depth: 0, hasChildren: false }));
  }
  function watchViewport(viewport: HTMLElement): void {
    viewport.onscroll = () => {
      if (
        viewport.scrollTop === scrollTop &&
        viewport.scrollLeft === scrollLeft
      ) {
        return;
      }
      scrollTop = viewport.scrollTop;
      scrollLeft = viewport.scrollLeft;
      if (frame == null) {
        frame = requestAnimationFrame(() => {
          frame = undefined;
          render();
        });
      }
    };
  }
  function timelineGeometry(
    rowCount: number
  ): TimelineGeometry & { height: number } {
    const width = { day: 40, week: 24, month: 10 }[view.zoom ?? "week"];
    const anchor = dateDay(view.anchorDate ?? firstDate());
    const weekStart = view.weekStartsOn ?? 1;
    const from =
      anchor - ((((((anchor + 4) % 7) + 7) % 7) - weekStart + 7) % 7);
    const count = 180;
    const availableWidth = container.clientWidth || 1100;
    const labelWidth = Math.min(
      LABEL_WIDTH,
      Math.max(144, Math.round(availableWidth * 0.42))
    );
    const totalWidth = labelWidth + count * width;
    const height = options.gantt?.height ?? 480;
    const columnFrom = Math.max(
      0,
      Math.floor((scrollLeft - labelWidth) / width) - 2
    );
    const columnTo = Math.min(
      count,
      columnFrom + Math.ceil(availableWidth / width) + 8
    );
    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 6);
    const lastRow = Math.min(
      rowCount,
      firstRow + Math.ceil(height / ROW_HEIGHT) + 14
    );
    return {
      height,
      from,
      labelWidth,
      width,
      count,
      totalWidth,
      columnFrom,
      columnTo,
      firstRow,
      lastRow,
    };
  }
  function appendTodayMarker(
    canvas: HTMLElement,
    geometry: TimelineGeometry
  ): void {
    const today =
      dateDay(new Date().toISOString().slice(0, 10)) - geometry.from;
    if (today >= 0 && today < geometry.count) {
      const marker = node("div", undefined, "yp-today-line");
      marker.style.left = `${geometry.labelWidth + (today + 0.5) * geometry.width}px`;
      marker.style.top = `${HEADER_HEIGHT}px`;
      marker.setAttribute("aria-hidden", "true");
      canvas.append(marker);
    }
  }
  function renderTimeline(): HTMLElement {
    const t = labels();
    const state = options.session.getState();
    const snapshot = state.snapshot;
    const region = node("section");
    region.setAttribute("aria-label", "Gantt");
    region.append(renderControls());
    const error = errorNode();
    if (error) {
      region.append(error);
    }
    if (!snapshot) {
      region.append(node("p", state.busy ? t.loading : t.noAdapter));
      return region;
    }
    const rows = visibleRows(snapshot);
    if (!rows.length) {
      const empty = node("div", undefined, "yp-empty");
      empty.append(node("p", options.emptyTitle ?? t.empty));
      if (options.onClearFilters) {
        empty.append(button(t.clear, options.onClearFilters));
      }
      region.append(empty);
      return region;
    }
    const geometry = timelineGeometry(rows.length);
    const { height, totalWidth, firstRow, lastRow } = geometry;
    const viewport = node("div", undefined, "yp-viewport");
    viewport.style.height = `${height}px`;
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute("aria-label", t.planning);
    const canvas = node("div", undefined, "yp-canvas");
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${HEADER_HEIGHT + ROW_HEIGHT * rows.length}px`;
    canvas.append(timelineHeader(geometry));
    for (let i = firstRow; i < lastRow; i += 1) {
      const currentRow = rows[i];
      if (!currentRow) {
        continue;
      }
      canvas.append(timelineRow(currentRow, i, snapshot, geometry));
    }
    if (view.showDependencies !== false) {
      canvas.append(timelineLinks(rows, snapshot, geometry));
    }
    appendTodayMarker(canvas, geometry);
    viewport.append(canvas);
    region.append(viewport);
    viewport.scrollTop = scrollTop;
    viewport.scrollLeft = scrollLeft;
    watchViewport(viewport);
    return region;
  }

  function dependencyEditor(
    task: PlanningTask,
    existing?: PlanningDependency
  ): HTMLElement {
    const t = labels();
    const state = options.session.getState();
    const snapshot = state.snapshot;
    const form = node("form", undefined, "yp-editor");
    if (!snapshot) {
      return form;
    }
    const sources = snapshot.sources.filter(
      (source) =>
        options.session.config.allowCrossTableDependencies ||
        source.id === task.ref.source
    );
    const source = select(
      sources.map((item) => ({ value: item.id, label: item.label })),
      existing?.from.source ?? task.ref.source,
      "dependency-source"
    );
    const taskOptions = (): { value: string; label: string }[] =>
      snapshot.tasks
        .filter(
          (item) =>
            item.ref.source === source.value &&
            !samePlanningRef(item.ref, task.ref)
        )
        .map((item) => ({ value: planningKey(item.ref), label: item.label }));
    const entries = taskOptions();
    const predecessor = select(
      entries,
      existing ? planningKey(existing.from) : (entries[0]?.value ?? ""),
      "dependency-task"
    );
    source.onchange = () => {
      const next = taskOptions();
      predecessor.replaceChildren(
        ...next.map((item) => {
          const option = node("option", item.label);
          option.value = item.value;
          return option;
        })
      );
      submit.disabled = !(
        next.length && options.session.config.dependencyTypes.length
      );
    };
    const type = select(
      options.session.config.dependencyTypes.map((value) => ({
        value,
        label: value,
      })),
      existing?.type ?? options.session.config.dependencyTypes[0] ?? "FS",
      "dependency-type"
    );
    const lag = input("number", String(existing?.lag ?? 0), "dependency-lag");
    lag.step = "1";
    lag.required = true;
    const unit = select(
      [
        { value: "workingDays", label: t.working },
        { value: "calendarDays", label: t.calendar },
      ],
      existing?.lagUnit ?? "workingDays",
      "dependency-unit"
    );
    form.append(
      field(t.source, source),
      field(t.predecessor, predecessor),
      field(t.type, type),
      field(t.lag, lag),
      field(t.unit, unit)
    );
    const submit = node("button", existing ? t.save : t.add);
    submit.type = "submit";
    submit.disabled = !(
      entries.length && options.session.config.dependencyTypes.length
    );
    form.append(submit);
    form.onsubmit = (event) => {
      event.preventDefault();
      const from = snapshot.tasks.find(
        (item) => planningKey(item.ref) === predecessor.value
      )?.ref;
      if (!from) {
        return;
      }
      options.session.request([
        {
          type: "dependency.put",
          dependency: {
            id: existing?.id ?? crypto.randomUUID(),
            from,
            to: task.ref,
            type: type.value as DependencyType,
            lag: Number(lag.value),
            lagUnit: unit.value as "workingDays" | "calendarDays",
          },
        },
      ]);
    };
    return form;
  }
  function taskDatesEditor(task: PlanningTask): HTMLElement {
    const t = labels();
    const session = options.session;
    const state = session.getState();
    const dates = node("form", undefined, "yp-editor");
    const start = input("date", task.start ?? "", "start-date");
    const end = input("date", task.end ?? "", "end-date");
    start.disabled = end.disabled =
      !(session.canEdit(task) && session.config.allowDateEdit) || state.busy;
    const parentOptions = [
      { value: "", label: t.root },
      ...(state.snapshot?.tasks ?? [])
        .filter((item) => !samePlanningRef(task.ref, item.ref))
        .map((item) => ({
          value: planningKey(item.ref),
          label: `${item.ref.source} · ${item.label}`,
        })),
    ];
    const parent = select(
      parentOptions,
      task.parent ? planningKey(task.parent) : "",
      "parent"
    );
    parent.disabled =
      !(session.canEdit(task) && session.config.allowHierarchyEdit) ||
      state.busy;
    dates.append(field(t.start, start), field(t.end, end));
    if (session.config.hierarchy) {
      dates.append(field(t.parent, parent));
    }
    const submit = node("button", t.save);
    submit.type = "submit";
    submit.disabled =
      !session.canEdit(task) ||
      state.busy ||
      !(session.config.allowDateEdit || session.config.allowHierarchyEdit);
    dates.append(submit);
    dates.onsubmit = (event) => {
      event.preventDefault();
      const mutations: import("./types").PlanningMutation[] = [];
      if (
        start.value !== (task.start ?? "") ||
        end.value !== (task.end ?? "")
      ) {
        mutations.push({
          type: "dates",
          ref: task.ref,
          start: start.value || null,
          end: end.value || null,
        });
      }
      const nextParent =
        state.snapshot?.tasks.find(
          (item) => planningKey(item.ref) === parent.value
        )?.ref ?? null;
      if (!samePlanningRef(nextParent, task.parent)) {
        mutations.push({ type: "parent", ref: task.ref, parent: nextParent });
      }
      if (mutations.length) {
        session.request(mutations);
      }
    };
    return dates;
  }
  function dependencyRow(
    edge: PlanningDependency,
    task: PlanningTask
  ): HTMLElement {
    const t = labels();
    const session = options.session;
    const state = session.getState();
    const row = node("div", undefined, "yp-dependency");
    const from = state.snapshot?.tasks.find((item) =>
      samePlanningRef(item.ref, edge.from)
    );
    const to = state.snapshot?.tasks.find((item) =>
      samePlanningRef(item.ref, edge.to)
    );
    row.append(
      node(
        "span",
        `${from?.label ?? edge.from.id} → ${to?.label ?? edge.to.id} · ${edge.type} · ${edge.lag ?? 0}`
      )
    );
    if (session.config.allowDependencyEdit && session.canEdit(task)) {
      if (samePlanningRef(edge.to, task.ref)) {
        row.append(
          button(
            t.edit,
            () => {
              editingLink = edge.id;
              render();
            },
            state.busy
          )
        );
      }
      row.append(
        button(
          t.remove,
          () => {
            session.request([{ type: "dependency.remove", id: edge.id }]);
          },
          state.busy
        )
      );
    }
    return row;
  }
  function taskEditor(task: PlanningTask): HTMLElement {
    const t = labels();
    const session = options.session;
    const state = session.getState();
    const body = node("div", undefined, "yp-dialog-body");
    const dates = taskDatesEditor(task);
    body.append(dates, node("h3", t.dependencies));
    const links =
      state.snapshot?.dependencies.filter(
        (edge) =>
          samePlanningRef(edge.to, task.ref) ||
          samePlanningRef(edge.from, task.ref)
      ) ?? [];
    for (const edge of links) {
      body.append(dependencyRow(edge, task));
    }
    if (session.config.allowDependencyEdit && session.canEdit(task)) {
      body.append(
        node("h4", editingLink ? t.edit : t.newLink),
        dependencyEditor(
          task,
          links.find((edge) => edge.id === editingLink)
        )
      );
    }
    if (
      options.onOpenRecord &&
      task.ref.source === options.session.config.sourceId
    ) {
      body.append(
        button(t.record, () => {
          session.open();
          options.onOpenRecord?.(task);
        })
      );
    }
    return body;
  }
  function reasonLabel(reason: string): string {
    const t = labels();
    if (reason === "requested") {
      return t.requested;
    }
    if (reason === "summary") {
      return t.summary;
    }
    if (reason.startsWith("dependency:")) {
      return `${t.dependency} ${reason.slice(11)}`;
    }
    return t.group;
  }
  function dependencyChanges(
    preview: import("./types").PlanningPreview
  ): HTMLElement {
    const t = labels();
    const body = node("div", undefined, "yp-dialog-body");
    const before = new Map(
      (options.session.getState().snapshot?.dependencies ?? []).map((edge) => [
        edge.id,
        edge,
      ])
    );
    const after = new Map(preview.dependencies.map((edge) => [edge.id, edge]));
    const describe = (edge?: PlanningDependency): string =>
      edge
        ? `${edge.from.source}/${edge.from.id} → ${edge.to.source}/${edge.to.id} · ${edge.type} · ${edge.lag ?? 0} ${edge.lagUnit === "calendarDays" ? t.calendar : t.working}`
        : "—";
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      if (JSON.stringify(before.get(id)) === JSON.stringify(after.get(id))) {
        continue;
      }
      body.append(
        node("h4", `${t.dependency} ${id}`),
        node("p", `${t.before}: ${describe(before.get(id))}`),
        node("p", `${t.after}: ${describe(after.get(id))}`)
      );
    }
    return body;
  }
  function taskChangeSummary(item: PlanningTask, other: PlanningTask): string {
    const t = labels();
    const fields = options.session
      .getState()
      .snapshot?.sources.find(
        (source) => source.id === item.ref.source
      )?.fields;
    const recordChanges = Object.keys({ ...item.record, ...other.record })
      .filter(
        (key) =>
          key !== fields?.start &&
          key !== fields?.end &&
          JSON.stringify(item.record?.[key]) !==
            JSON.stringify(other.record?.[key])
      )
      .map((key) => `${key}: ${JSON.stringify(item.record?.[key] ?? null)}`);
    const parent = item.parent
      ? `${item.parent.source}/${item.parent.id}`
      : t.root;
    return [
      `${item.start ?? t.noDates} → ${item.end ?? t.noDates}`,
      `${t.parent}: ${parent}`,
      ...recordChanges,
    ].join(" · ");
  }
  function previewBody(
    preview: import("./types").PlanningPreview
  ): HTMLElement {
    const state = options.session.getState();
    const t = labels();
    const body = node("div");
    const table = node("table");
    const head = node("thead");
    const row = node("tr");
    for (const label of [t.task, t.before, t.after, t.reason]) {
      row.append(node("th", label));
    }
    head.append(row);
    table.append(head);
    const tbody = node("tbody");
    for (const change of preview.changes) {
      const tr = node("tr");
      const reason = change.reasons.map((item) => reasonLabel(item)).join(", ");
      for (const text of [
        `${change.ref.source} · ${change.after.label}`,
        taskChangeSummary(change.before, change.after),
        taskChangeSummary(change.after, change.before),
        reason,
      ]) {
        tr.append(node("td", text));
      }
      tbody.append(tr);
    }
    table.append(tbody);
    const scroll = node("div", undefined, "yp-preview-table");
    scroll.append(table);
    body.append(scroll, dependencyChanges(preview));
    for (const warning of preview.warnings) {
      body.append(node("p", warning, "yp-warning"));
    }
    const actions = node("div", undefined, "yp-dialog-actions");
    actions.append(
      button(
        t.cancel,
        () => options.session.cancel(),
        state.busy,
        "cancel-preview"
      ),
      button(
        t.apply,
        () => {
          options.session.apply();
        },
        state.busy,
        "apply-preview"
      )
    );
    body.append(actions);
    return body;
  }
  function ensureDialog(): void {
    if (!dialog) {
      restoreFocus =
        doc.activeElement instanceof HTMLElement
          ? doc.activeElement
          : undefined;
      dialog = node("dialog", undefined, "yp-dialog");
      // Keep nested planning dialogs inside the active modal's accessibility boundary.
      const activeModal = doc.activeElement?.closest<HTMLElement>(
        '[role="dialog"],dialog'
      );
      const target =
        activeModal && !activeModal.classList.contains("yp-dialog")
          ? activeModal
          : container;
      target.append(dialog);
      dialog.oncancel = (event) => {
        event.preventDefault();
        if (options.session.getState().busy) {
          return;
        }
        if (options.session.getState().preview) {
          options.session.cancel();
        } else {
          options.session.open();
        }
      };
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
  }
  function closeDialog(): void {
    if (dialog) {
      dialog.close?.();
      dialog.remove();
      dialog = undefined;
      restoreFocus?.focus();
      restoreFocus = undefined;
    }
  }
  function captureDrafts(task?: PlanningTask): void {
    const revision = options.session.getState().snapshot?.revision ?? "";
    const context = `${task ? planningKey(task.ref) : ""}:${revision}:${editingLink ?? ""}`;
    if (context !== draftContext) {
      drafts.clear();
      draftContext = context;
      return;
    }
    for (const control of dialog?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("input[data-focus],select[data-focus]") ?? []) {
      if (control.dataset.focus) {
        drafts.set(control.dataset.focus, control.value);
      }
    }
  }
  function renderOverlay(): void {
    const state = options.session.getState();
    const t = labels();
    const task = state.snapshot?.tasks.find((item) =>
      samePlanningRef(item.ref, state.selected)
    );
    if (!(task || state.preview)) {
      closeDialog();
      drafts.clear();
      draftContext = "";
      return;
    }
    const activeKey = (doc.activeElement as HTMLElement | null)?.dataset.focus;
    ensureDialog();
    if (!dialog) {
      return;
    }
    captureDrafts(task);
    dialog.replaceChildren();
    dialog.setAttribute(
      "aria-label",
      state.preview ? t.preview : `${t.planning}: ${task?.label ?? ""}`
    );
    const heading = node("div", undefined, "yp-dialog-heading");
    heading.append(node("h2", state.preview ? t.preview : task?.label));
    const close = button(
      t.close,
      () => {
        if (state.preview) {
          options.session.cancel();
        } else {
          options.session.open();
        }
      },
      state.busy,
      "close-dialog"
    );
    close.setAttribute("aria-label", t.close);
    close.title = t.close;
    close.className = "yp-icon-button";
    close.replaceChildren(icon("close"));
    heading.append(close);
    dialog.append(heading);
    const error = errorNode();
    if (error) {
      dialog.append(error);
    }
    if (state.preview) {
      dialog.append(previewBody(state.preview));
    } else if (task) {
      dialog.append(taskEditor(task));
    }
    if (state.busy) {
      const loading = node("p", t.loading);
      loading.setAttribute("role", "status");
      dialog.append(loading);
    }
    if (activeKey) {
      Array.from(dialog.querySelectorAll<HTMLElement>("[data-focus]"))
        .find((item) => item.dataset.focus === activeKey)
        ?.focus();
    }
  }
  function render(): void {
    if (options.mode === "overlay") {
      renderOverlay();
      return;
    }
    const activeKey = (doc.activeElement as HTMLElement | null)?.dataset.focus;
    container.replaceChildren(renderTimeline());
    const viewport = container.querySelector<HTMLElement>(".yp-viewport");
    if (viewport) {
      viewport.scrollTop = scrollTop;
      viewport.scrollLeft = scrollLeft;
    }
    if (activeKey) {
      Array.from(container.querySelectorAll<HTMLElement>("[data-focus]"))
        .find((item) => item.dataset.focus === activeKey)
        ?.focus({ preventScroll: true });
    }
  }
  const unsubscribe = options.session.subscribe(render);
  // Resizing the host must keep the sticky tree, virtual columns and links aligned.
  let measuredWidth = container.clientWidth;
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (measuredWidth !== container.clientWidth) {
            measuredWidth = container.clientWidth;
            render();
          }
        });
  if (options.mode === "gantt") {
    resizeObserver?.observe(container);
  }
  render();
  return {
    update(next: PlanningSurfaceOptions): void {
      options = next;
      view = normalizeGanttView(next.gantt);
      render();
    },
    destroy(): void {
      unsubscribe();
      resizeObserver?.disconnect();
      if (frame != null) {
        cancelAnimationFrame(frame);
      }
      dialog?.close?.();
      container.replaceChildren();
      restoreFocus?.focus();
    },
  };
}
