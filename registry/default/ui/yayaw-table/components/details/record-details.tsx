"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Tabs } from "@base-ui/react/tabs";
import { Clock3, History, Pencil, Trash2 } from "lucide-react";
import {
  isValidElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import type { ColumnDefinition } from "../../config/helpers";
import {
  type DetailActivity,
  type DetailCustomSection,
  type DetailField,
  type DetailLabels,
  type DetailRecord,
  type DetailRevertHandler,
  deleteConfirmationMatches,
  deleteConfirmationValue,
  detailActivity,
  detailDate,
  detailLabels,
  detailLayout,
  detailSections,
  detailTitle,
  detailValue,
  type RecordDetailsConfig,
} from "../../utils/record-details";
import { RecordSurface, RecordSurfaceHeader } from "../records/record-surface";
import { DetailValue } from "./detail-value";
import { RecordActivity } from "./record-activity";
import { RelatedRecords } from "./related-records";
import { TypedConfirmation } from "./typed-confirmation";
import "./record-details.css";

export interface RecordDetailsProps {
  /** Keeps the surrounding surface mounted while editing the current record. */
  editor?: ReactNode;
  editorBusy?: boolean;
  row: DetailRecord;
  config: RecordDetailsConfig;
  columns?: ColumnDefinition[];
  locale?: string;
  onClose: () => void;
  onPlanning?: (row: DetailRecord) => void;
  onEdit?: (row: DetailRecord) => void;
  onDelete?: (
    row: DetailRecord
  ) =>
    | Promise<{ success: boolean; error?: string }>
    | { success: boolean; error?: string };
  onDeleted?: (row: DetailRecord) => void;
  onRevertActivity?: DetailRevertHandler;
  onReverted?: (entry: DetailActivity) => void;
  /** Renders a field; return `undefined` for `config.renderField` or the standard renderer. */
  renderField?: (
    field: DetailField,
    value: unknown,
    row: DetailRecord
  ) => ReactNode;
  /** Renders a custom section; return `undefined` for `config.renderSection`. */
  renderSection?: (
    section: DetailCustomSection,
    row: DetailRecord
  ) => ReactNode;
}

/** A render hook's output when React can render it; `undefined` otherwise. */
function asReactNode(value: unknown): ReactNode | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isValidElement(value)
  ) {
    return value;
  }
  return Array.isArray(value) ? (value as ReactNode[]) : undefined;
}

function DetailHeader({
  row,
  title,
  config,
  locale,
  labels,
  busy,
  onPlanning,
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
  onPlanning?: (row: DetailRecord) => void;
  onEdit?: (row: DetailRecord) => void;
  onDelete?: () => void;
  onClose: () => void;
  deleteButton: RefObject<HTMLButtonElement | null>;
}) {
  const updated = config.updatedAt?.(row);
  const updatedBy = config.updatedBy?.(row);
  return (
    <>
      <RecordSurfaceHeader
        busy={busy}
        closeLabel={labels.close}
        description={config.description?.(row)}
        onClose={onClose}
        title={title}
      >
        <div className="yayaw-detail-actions">
          {onPlanning && (
            <Button
              disabled={busy}
              onClick={() => onPlanning(row)}
              type="button"
              variant="outline"
            >
              {locale.startsWith("fr") ? "Planification" : "Planning"}
            </Button>
          )}
          {onEdit ? (
            <Button
              data-record-edit=""
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
        </div>
      </RecordSurfaceHeader>
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
  editor,
  editorBusy,
  row,
  config,
  columns = [],
  locale = "en",
  onClose,
  onPlanning,
  onEdit,
  onDelete,
  onDeleted,
  onRevertActivity,
  onReverted,
  renderField,
  renderSection,
}: RecordDetailsProps) {
  const contentRef = useRef<HTMLElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editor) {
      contentRef.current
        ?.querySelector<HTMLElement>("[data-record-edit]")
        ?.focus();
    }
    wasEditing.current = Boolean(editor);
  }, [editor]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletionPending = useRef(false);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const typedInput = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const labels = detailLabels(locale, config.labels);
  const title = detailTitle(config, row, labels.record);
  const sections = detailSections(config, columns, row, labels.details);
  const layout = detailLayout(config, columns, row, labels.details);
  const fields = sections.flatMap((section) => section.fields);
  const expected = deleteConfirmationValue(
    config.deleteConfirmation,
    { row, title },
    labels
  );
  const confirmed = deleteConfirmationMatches(
    expected,
    typed,
    config.deleteConfirmation
  );
  const fieldContent = (field: DetailField) => {
    const value = detailValue(row, field);
    return (
      renderField?.(field, value, row) ??
      asReactNode(config.renderField?.(field, value, row)) ?? (
        <DetailValue
          field={field}
          labels={labels}
          locale={locale}
          row={row}
          value={value}
        />
      )
    );
  };
  const activity = detailActivity(config, row);
  const [undoPending, setUndoPending] = useState(false);
  const confirmDelete = async () => {
    if (!onDelete || deletionPending.current || undoPending || !confirmed) {
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
        aria-busy={deleting || undoPending}
        aria-label={title}
        className="yayaw-detail yayaw-record-content"
        ref={contentRef}
      >
        <DetailHeader
          busy={confirming || deleting || undoPending}
          config={config}
          deleteButton={deleteButton}
          labels={labels}
          locale={locale}
          onClose={onClose}
          onDelete={
            onDelete
              ? () => {
                  setError("");
                  setTyped("");
                  setConfirming(true);
                }
              : undefined
          }
          onEdit={onEdit}
          onPlanning={onPlanning}
          row={row}
          title={title}
        />
        <Tabs.Root
          className="yayaw-detail-tabs yayaw-record-content"
          defaultValue="details"
        >
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
          <Tabs.Panel
            className="yayaw-detail-body yayaw-record-body"
            value="details"
          >
            {layout.map((item) => {
              if (item.kind === "related") {
                return (
                  <RelatedRecords
                    key={item.section.id}
                    labels={labels}
                    loadRelated={config.loadRelated}
                    locale={locale}
                    onRelatedAction={config.onRelatedAction}
                    row={row}
                    section={item.section}
                  />
                );
              }
              if (item.kind === "custom") {
                const custom =
                  renderSection?.(item.section, row) ??
                  asReactNode(config.renderSection?.(item.section, row));
                return custom == null ? null : (
                  <section
                    className="yayaw-detail-section"
                    data-custom-section={item.section.id}
                    key={item.section.id}
                  >
                    <h3>{item.section.title}</h3>
                    {item.section.description ? (
                      <p className="yayaw-detail-description">
                        {item.section.description}
                      </p>
                    ) : null}
                    {custom}
                  </section>
                );
              }
              const section = item.section;
              return (
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
                        <dd>{fieldContent(field)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
            {layout.length === 0 ? (
              <p className="yayaw-detail-empty">{labels.empty}</p>
            ) : null}
          </Tabs.Panel>
          {/* Kept mounted: a pending or completed undo survives switching tabs. */}
          <Tabs.Panel
            className="yayaw-detail-body yayaw-record-body"
            keepMounted
            value="activity"
          >
            <RecordActivity
              activity={activity}
              config={config}
              disabled={deleting || confirming}
              fields={fields}
              labels={labels}
              locale={locale}
              onPendingChange={setUndoPending}
              onRevertActivity={onRevertActivity}
              onReverted={onReverted}
              row={row}
            />
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
            initialFocus={expected === undefined ? cancelButton : typedInput}
          >
            <AlertDialog.Title>{labels.confirmDelete}</AlertDialog.Title>
            <AlertDialog.Description>
              {labels.deleteDescription}
            </AlertDialog.Description>
            <strong>{title}</strong>
            {expected === undefined ? null : (
              <TypedConfirmation
                confirmation={config.deleteConfirmation}
                disabled={deleting}
                expected={expected}
                inputRef={typedInput}
                labels={labels}
                onChange={setTyped}
                onSubmit={confirmDelete}
                value={typed}
              />
            )}
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
                disabled={deleting || !onDelete || !confirmed}
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
  return (
    <RecordSurface
      busy={deleting || confirming || undoPending || editorBusy}
      onClose={onClose}
      presentation={config.presentation}
      title={title}
      width={config.width}
    >
      {editor ?? content}
    </RecordSurface>
  );
}
