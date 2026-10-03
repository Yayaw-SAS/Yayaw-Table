"use client";

import { Undo2 } from "lucide-react";
import { createContext, type ReactNode } from "react";
import {
  type DetailActivity,
  type DetailField,
  type DetailLabels,
  type DetailRecord,
  type DetailRevertHandler,
  detailDate,
  type RecordDetailsConfig,
} from "../../utils/record-details";
import { DetailValue } from "./detail-value";
import { useActivityUndo } from "./use-activity-undo";
import "./record-details.css";

/** The table's record view and rows: the edit form shows the record's activity next to its fields when the host keeps one. */
export const RecordActivityContext = createContext<
  | {
      details?: RecordDetailsConfig;
      onRevertActivity?: DetailRevertHandler;
      rows: DetailRecord[];
      getRowId?: (row: DetailRecord) => string;
      refresh: () => Promise<unknown>;
    }
  | undefined
>(undefined);

function ActivityEntry({
  entry,
  fields,
  row,
  locale,
  labels,
  undoAction,
}: {
  entry: DetailActivity;
  fields: DetailField[];
  row: DetailRecord;
  locale: string;
  labels: DetailLabels;
  undoAction?: ReactNode;
}) {
  return (
    <li>
      <span aria-hidden="true" className="yayaw-detail-avatar">
        {entry.actor.name
          .split(" ")
          .map((part) => part[0])
          .slice(0, 2)
          .join("")}
      </span>
      <div className="yayaw-detail-event">
        <p>
          <strong>{entry.actor.name}</strong> {entry.action}
        </p>
        <time dateTime={entry.at}>{detailDate(entry.at, locale, true)}</time>
        {undoAction}
        {entry.changes?.map((change) => {
          const field = fields.find((item) => item.id === change.field);
          if (!field) {
            return null;
          }
          return (
            <div className="yayaw-detail-change" key={change.field}>
              <p>{field.label}</p>
              <div className="yayaw-detail-diff">
                <div>
                  <small>{labels.before}</small>
                  <DetailValue
                    field={field}
                    labels={labels}
                    locale={locale}
                    row={row}
                    value={change.before}
                  />
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>{labels.after}</small>
                  <DetailValue
                    field={field}
                    labels={labels}
                    locale={locale}
                    row={row}
                    value={change.after}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </li>
  );
}

function ActivityUndoControl({
  entry,
  undo,
  labels,
  enabled,
  busy,
}: {
  entry: DetailActivity;
  undo: ReturnType<typeof useActivityUndo>;
  labels: DetailLabels;
  enabled: boolean;
  busy: boolean;
}) {
  const showUndo =
    enabled &&
    Boolean(entry.changes?.length) &&
    !entry.reverts &&
    entry.reversible !== false &&
    !undo.isUndone(entry);
  return (
    <>
      {undo.isUndone(entry) ? (
        <span className="yayaw-detail-undone">{labels.undone}</span>
      ) : null}
      {showUndo ? (
        <button
          className="yayaw-detail-undo"
          disabled={!undo.canUndo(entry) || Boolean(undo.pending) || busy}
          onClick={() => undo.undo(entry)}
          title={undo.canUndo(entry) ? labels.undo : labels.undoUnavailable}
          type="button"
        >
          <Undo2 aria-hidden="true" size={13} />
          {undo.pending === entry.id ? labels.undoing : labels.undo}
        </button>
      ) : null}
      {undo.error?.id === entry.id ? (
        <p role="alert">{undo.error.message}</p>
      ) : null}
    </>
  );
}

/** A record's activity timeline and its undo buttons, shared by the record details and the edit form. */
export function RecordActivity({
  row,
  activity,
  fields,
  labels,
  locale = "en",
  disabled = false,
  config,
  onRevertActivity,
  onReverted,
  onPendingChange,
}: {
  row: DetailRecord;
  activity: DetailActivity[];
  fields: DetailField[];
  labels: DetailLabels;
  locale?: string;
  disabled?: boolean;
  config: RecordDetailsConfig;
  onRevertActivity?: DetailRevertHandler;
  onReverted?: (entry: DetailActivity) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const undo = useActivityUndo({
    activity,
    row,
    config,
    labels,
    handler: onRevertActivity,
    onReverted,
    onPendingChange,
  });
  if (!activity.length) {
    return <p className="yayaw-detail-empty">{labels.noActivity}</p>;
  }
  return (
    <ol className="yayaw-detail-timeline">
      {activity.map((entry) => (
        <ActivityEntry
          entry={entry}
          fields={fields}
          key={entry.id}
          labels={labels}
          locale={locale}
          row={row}
          undoAction={
            <ActivityUndoControl
              busy={disabled}
              enabled={Boolean(onRevertActivity)}
              entry={entry}
              labels={labels}
              undo={undo}
            />
          }
        />
      ))}
    </ol>
  );
}
