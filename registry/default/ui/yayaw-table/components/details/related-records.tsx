"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  type DetailLabels,
  type DetailRecord,
  type DetailRelatedActionEvent,
  type DetailRelatedLoader,
  type DetailRelatedSection,
  detailValue,
  loadRelatedRecords,
  relatedRowKey,
  relatedView,
} from "../../utils/record-details";
import { DetailValue } from "./detail-value";
import "./record-details.css";

type RelatedState =
  | { status: "idle" | "loading" }
  | { status: "error"; error: string }
  | { status: "loaded"; rows: DetailRecord[] };

/** Becomes true once the element is on screen; immediately without IntersectionObserver. */
function useSeen(
  element: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!active || seen) {
      return;
    }
    const node = element.current;
    if (!(node && typeof IntersectionObserver === "function")) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, element, seen]);
  return seen;
}

/** Loads a related list once it is ready, ignoring answers to superseded requests. */
function useRelatedRows({
  errorLabel,
  loadRelated,
  ready,
  row,
  section,
}: {
  errorLabel: string;
  loadRelated?: DetailRelatedLoader;
  ready: boolean;
  row: DetailRecord;
  section: DetailRelatedSection;
}) {
  const [state, setState] = useState<RelatedState>({ status: "idle" });
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = request.current + 1;
    request.current = current;
    setState({ status: "loading" });
    try {
      const rows = await loadRelatedRecords(section, row, loadRelated);
      if (request.current === current) {
        setState({ status: "loaded", rows });
      }
    } catch (cause) {
      if (request.current === current) {
        setState({
          status: "error",
          error:
            cause instanceof Error && cause.message
              ? cause.message
              : errorLabel,
        });
      }
    }
  }, [errorLabel, loadRelated, row, section]);
  const shouldLoad = ready && state.status === "idle";
  useEffect(() => {
    if (shouldLoad) {
      load().catch(() => undefined);
    }
  }, [load, shouldLoad]);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  return { load, state };
}

/** The loaded rows of a related list, with an Open button per row when the host handles it. */
function RelatedTable({
  labels,
  locale,
  onOpen,
  section,
  view,
}: {
  labels: DetailLabels;
  locale: string;
  onOpen?: (related: DetailRecord) => void;
  section: DetailRelatedSection;
  view: ReturnType<typeof relatedView>;
}) {
  const hidden = view.total - view.rows.length;
  return (
    <>
      <table className="yayaw-detail-related-table">
        <thead>
          <tr>
            {section.columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
            {onOpen ? (
              <th scope="col">
                <span className="sr-only">
                  {section.open?.label ?? labels.open}
                </span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((related, index) => (
            <tr key={relatedRowKey(related, index)}>
              {section.columns.map((column) => (
                <td key={column.id}>
                  <DetailValue
                    field={column}
                    labels={labels}
                    locale={locale}
                    row={related}
                    value={detailValue(related, column)}
                  />
                </td>
              ))}
              {onOpen ? (
                <td>
                  <button
                    className="yayaw-detail-related-button"
                    onClick={() => onOpen(related)}
                    type="button"
                  >
                    {section.open?.label ?? labels.open}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 ? (
        <p className="yayaw-detail-related-more">
          {labels.relatedMore.replaceAll("{count}", String(hidden))}
        </p>
      ) : null}
    </>
  );
}

/** A related list: loads its records once open and visible, then shows them with the host's actions. */
export function RelatedRecords({
  labels,
  loadRelated,
  locale,
  onRelatedAction,
  row,
  section,
}: {
  labels: DetailLabels;
  loadRelated?: DetailRelatedLoader;
  locale: string;
  onRelatedAction?: (event: DetailRelatedActionEvent) => void;
  row: DetailRecord;
  section: DetailRelatedSection;
}) {
  const id = useId();
  const element = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(section.collapsed !== true);
  const seen = useSeen(element, open);
  const { load, state } = useRelatedRows({
    errorLabel: labels.relatedError,
    loadRelated,
    ready: open && seen,
    row,
    section,
  });
  const act = (kind: "open" | "add", related?: DetailRecord) => {
    const action = section[kind];
    if (!(action && onRelatedAction)) {
      return;
    }
    onRelatedAction({ action: action.action, kind, section, row, related });
  };
  const view =
    state.status === "loaded" ? relatedView(section, state.rows) : undefined;
  const showOpen = Boolean(section.open && onRelatedAction);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="yayaw-detail-section yayaw-detail-related"
      data-related-section={section.id}
      ref={element}
    >
      <div className="yayaw-detail-related-header">
        <h3 id={`${id}-title`}>
          <button
            aria-controls={`${id}-body`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <ChevronDown aria-hidden="true" size={14} />
            {section.title}
            {view ? (
              <span className="yayaw-detail-count">{view.total}</span>
            ) : null}
          </button>
        </h3>
        {section.add && onRelatedAction ? (
          <button
            className="yayaw-detail-related-button"
            onClick={() => act("add")}
            type="button"
          >
            <Plus aria-hidden="true" size={13} />
            {section.add.label ?? labels.add}
          </button>
        ) : null}
      </div>
      {section.description ? (
        <p className="yayaw-detail-description">{section.description}</p>
      ) : null}
      <div
        className="yayaw-detail-related-body"
        hidden={!open}
        id={`${id}-body`}
      >
        {state.status === "loading" || state.status === "idle" ? (
          <output className="yayaw-detail-related-status">
            {labels.relatedLoading}
          </output>
        ) : null}
        {state.status === "error" ? (
          <div className="yayaw-detail-related-status" role="alert">
            <span>{state.error}</span>
            <button
              className="yayaw-detail-related-button"
              onClick={() => {
                load().catch(() => undefined);
              }}
              type="button"
            >
              {labels.retry}
            </button>
          </div>
        ) : null}
        {view && view.total === 0 ? (
          <p className="yayaw-detail-empty">
            {section.empty ?? labels.relatedEmpty}
          </p>
        ) : null}
        {view && view.total > 0 ? (
          <RelatedTable
            labels={labels}
            locale={locale}
            onOpen={showOpen ? (related) => act("open", related) : undefined}
            section={section}
            view={view}
          />
        ) : null}
      </div>
    </section>
  );
}
