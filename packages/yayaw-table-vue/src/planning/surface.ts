import { type PlanningSurfaceLabels, planningLabels } from "./labels";
import type { PlanningSession } from "./session";
import {
  type DependencyType,
  type PlanningDependency,
  type PlanningTask,
  planningKey,
  samePlanningRef,
} from "./types";

/**
 * The planning dialog: task dates, relationships and the preview/apply review.
 * Both editions share it because it is a modal form, independent of any table state.
 * Each edition renders its own timeline from the planning/timeline model.
 */
export interface PlanningSurfaceOptions {
  session: PlanningSession;
  locale?: string;
  onOpenRecord?: (task: PlanningTask) => void;
  /** Host translations for the planning vocabulary; unset keys keep their built-in value. */
  labels?: Partial<PlanningSurfaceLabels>;
}
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
  let dialog: HTMLDialogElement | undefined;
  let editingLink: string | undefined;
  let restoreFocus: HTMLElement | undefined;
  const drafts = new Map<string, string>();
  let draftContext = "";
  const doc = container.ownerDocument;
  container.classList.add("yayaw-planning");
  const labels = (): PlanningSurfaceLabels =>
    planningLabels(options.locale, options.labels);
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
              renderOverlay();
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
  const unsubscribe = options.session.subscribe(renderOverlay);
  renderOverlay();
  return {
    update(next: PlanningSurfaceOptions): void {
      options = next;
      renderOverlay();
    },
    destroy(): void {
      unsubscribe();
      dialog?.close?.();
      container.replaceChildren();
      restoreFocus?.focus();
    },
  };
}
