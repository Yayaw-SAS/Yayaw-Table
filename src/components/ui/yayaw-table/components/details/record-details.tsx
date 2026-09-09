"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { Clock3, History, Pencil, Trash2, Undo2, X } from "lucide-react";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ColumnDefinition } from "../../config/helpers";
import {
  type DetailActivity,
  type DetailField,
  type DetailLabels,
  type DetailRecord,
  type DetailRevertHandler,
  detailActivity,
  detailDate,
  detailLabels,
  detailSections,
  detailValue,
  type RecordDetailsConfig,
} from "../../utils/record-details";
import { DetailValue } from "./detail-value";
import { useActivityUndo } from "./use-activity-undo";
import "./record-details.css";

export interface RecordDetailsProps {
  row: DetailRecord;
  config: RecordDetailsConfig;
  columns?: ColumnDefinition[];
  locale?: string;
  onClose: () => void;
  onEdit?: (row: DetailRecord) => void;
  onDelete?: (
    row: DetailRecord
  ) =>
    | Promise<{ success: boolean; error?: string }>
    | { success: boolean; error?: string };
  onDeleted?: (row: DetailRecord) => void;
  onRevertActivity?: DetailRevertHandler;
  onReverted?: (entry: DetailActivity) => void;
  renderField?: (
    field: DetailField,
    value: unknown,
    row: DetailRecord
  ) => ReactNode;
}

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

function DetailHeader({
  row,
  title,
  config,
  locale,
  labels,
  busy,
  onEdit,
  onDelete,
  onClose,
  deleteButton,
}: {
  row: DetailRecord;
  title: string;
  config: RecordDetailsConfig;
  locale: string;
  labels: DetailLabels;
  busy: boolean;
  onEdit?: (row: DetailRecord) => void;
  onDelete?: () => void;
  onClose: () => void;
  deleteButton: RefObject<HTMLButtonElement | null>;
}) {
  const updated = config.updatedAt?.(row);
  const updatedBy = config.updatedBy?.(row);
  const inline = config.presentation === "inline";
  return (
    <>
      <header className="yayaw-detail-header">
        <div className="yayaw-detail-heading">
          <p className="yayaw-detail-eyebrow">
            {labels.record} {row.id ? <span>/ {String(row.id)}</span> : null}
          </p>
          <h2>{title}</h2>
          {config.description ? (
            <p className="yayaw-detail-description">
              {config.description(row)}
            </p>
          ) : null}
        </div>
        <div className="yayaw-detail-actions">
          {onEdit ? (
            <Button
              disabled={busy}
              onClick={() => onEdit(row)}
              variant="outline"
            >
              <Pencil aria-hidden="true" size={15} />
              {labels.edit}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              className="yayaw-detail-delete"
              disabled={busy}
              onClick={onDelete}
              ref={deleteButton}
              variant="outline"
            >
              <Trash2 aria-hidden="true" size={15} />
              {labels.delete}
            </Button>
          ) : null}
          {inline ? (
            <Button
              aria-label={labels.close}
              disabled={busy}
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X size={16} />
            </Button>
          ) : null}
        </div>
      </header>
      {updated ? (
        <div className="yayaw-detail-meta">
          <Clock3 aria-hidden="true" size={14} />
          <span>
            {labels.updated}{" "}
            <time
              dateTime={
                updated instanceof Date ? updated.toISOString() : updated
              }
            >
              {detailDate(updated, locale, true)}
            </time>
            {updatedBy ? (
              <>
                {" "}
                · {labels.by} <strong>{updatedBy}</strong>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  );
}

/** Mount with a stable record key; the content works in a drawer, modal, or any page container. */
export function RecordDetails({
  row,
  config,
  columns = [],
  locale = "en",
  onClose,
  onEdit,
  onDelete,
  onDeleted,
  onRevertActivity,
  onReverted,
  renderField,
}: RecordDetailsProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletionPending = useRef(false);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const labels = detailLabels(locale, config.labels);
  const title =
    config.title?.(row) ??
    String(row.name ?? row.title ?? row.id ?? labels.record);
  const sections = detailSections(config, columns, row, labels.details);
  const fields = sections.flatMap((section) => section.fields);
  const activity = detailActivity(config, row);
  const undo = useActivityUndo({
    activity,
    row,
    config,
    labels,
    handler: onRevertActivity,
    onReverted,
  });
  const inline = config.presentation === "inline";
  const confirmDelete = async () => {
    if (!onDelete || deletionPending.current || undo.pending) {
      return;
    }
    deletionPending.current = true;
    setDeleting(true);
    setError("");
    try {
      const result = await onDelete(row);
      if (!result.success) {
        throw new Error(result.error ?? labels.deleteError);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : labels.deleteError);
      return;
    } finally {
      deletionPending.current = false;
      setDeleting(false);
    }
    // Refresh callbacks run outside mutation error handling, so a completed delete cannot be repeated.
    setConfirming(false);
    onClose();
    onDeleted?.(row);
  };
  const content = (
    <>
      <article
        aria-busy={deleting || Boolean(undo.pending)}
        aria-label={title}
        className="yayaw-detail"
      >
        <DetailHeader
          busy={confirming || deleting || Boolean(undo.pending)}
          config={config}
          deleteButton={deleteButton}
          labels={labels}
          locale={locale}
          onClose={onClose}
          onDelete={
            onDelete
              ? () => {
                  setError("");
                  setConfirming(true);
                }
              : undefined
          }
          onEdit={onEdit}
          row={row}
          title={title}
        />
        <Tabs.Root defaultValue="details">
          <Tabs.List
            aria-label={labels.record}
            className="yayaw-detail-tablist"
          >
            <Tabs.Tab value="details">{labels.details}</Tabs.Tab>
            <Tabs.Tab value="activity">
              <History aria-hidden="true" size={15} />
              {labels.activity}
              <span className="yayaw-detail-count">{activity.length}</span>
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel className="yayaw-detail-body" value="details">
            {sections.map((section) => (
              <section className="yayaw-detail-section" key={section.id}>
                <h3>{section.title}</h3>
                {section.description ? (
                  <p className="yayaw-detail-description">
                    {section.description}
                  </p>
                ) : null}
                <dl>
                  {section.fields.map((field) => (
                    <div className="yayaw-detail-field" key={field.id}>
                      <dt>{field.label}</dt>
                      <dd>
                        {renderField?.(field, detailValue(row, field), row) ?? (
                          <DetailValue
                            field={field}
                            labels={labels}
                            locale={locale}
                            row={row}
                            value={detailValue(row, field)}
                          />
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {sections.length === 0 ? (
              <p className="yayaw-detail-empty">{labels.empty}</p>
            ) : null}
          </Tabs.Panel>
          <Tabs.Panel className="yayaw-detail-body" value="activity">
            {activity.length ? (
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
                        busy={deleting || confirming}
                        enabled={Boolean(onRevertActivity)}
                        entry={entry}
                        labels={labels}
                        undo={undo}
                      />
                    }
                  />
                ))}
              </ol>
            ) : (
              <p className="yayaw-detail-empty">{labels.noActivity}</p>
            )}
          </Tabs.Panel>
        </Tabs.Root>
      </article>
      <AlertDialog.Root
        onOpenChange={(open) => {
          if (!deleting) {
            setConfirming(open);
          }
        }}
        open={confirming}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="yayaw-detail-overlay yayaw-detail-overlay-confirm" />
          <AlertDialog.Popup
            className="yayaw-detail-surface yayaw-detail-confirm-surface"
            finalFocus={deleteButton}
            initialFocus={cancelButton}
          >
            <AlertDialog.Title>{labels.confirmDelete}</AlertDialog.Title>
            <AlertDialog.Description>
              {labels.deleteDescription}
            </AlertDialog.Description>
            <strong>{title}</strong>
            {error ? <p role="alert">{error}</p> : null}
            <div className="yayaw-detail-actions">
              <Button
                disabled={deleting}
                onClick={() => setConfirming(false)}
                ref={cancelButton}
                variant="outline"
              >
                {labels.cancel}
              </Button>
              <Button
                disabled={deleting || !onDelete}
                onClick={confirmDelete}
                variant="destructive"
              >
                {deleting ? labels.deleting : labels.delete}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
  if (inline) {
    return content;
  }
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!(open || deleting || confirming || undo.pending)) {
          onClose();
        }
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="yayaw-detail-overlay" />
        <Dialog.Popup
          className="yayaw-detail-surface"
          data-presentation={config.presentation ?? "drawer"}
          style={{
            width:
              config.width ??
              (config.presentation === "modal"
                ? "min(880px, 94vw)"
                : "min(720px, 100vw)"),
          }}
        >
          <div className="yayaw-detail-dialog-header">
            <Dialog.Title>{labels.record}</Dialog.Title>
            <Button
              aria-label={labels.close}
              disabled={deleting || confirming || Boolean(undo.pending)}
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X size={16} />
            </Button>
          </div>
          {content}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
