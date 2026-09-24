// biome-ignore-all lint/a11y/useSemanticElements: treegrid status rows and the pane splitter follow WAI-ARIA patterns without native elements.
// biome-ignore-all lint/a11y/useFocusableInteractive: status rows and cells are not tab stops in a row-focus treegrid.
"use client";

import {
  ChevronRight,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FilePlay,
  FileText,
  Folder,
  FolderOpen,
  type LucideIcon,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileTreeController } from "../utils/filetree-controller";
import {
  detailsWidthAfterKey,
  FILETREE_DETAILS_MAX,
  FILETREE_DETAILS_MIN,
  startDetailsResize,
} from "../utils/filetree-dom";
import {
  type FileTreeIcon,
  type FileTreeIconKind,
  type FileTreeLabelKey,
  type FileTreeVisibleRow,
  highlightFileTreeName,
  indentLevel,
} from "../utils/filetree-model";

type Row = Record<string, unknown>;
export type Label = (
  key: FileTreeLabelKey,
  params?: Record<string, string | number>
) => string;

const ICONS: Record<FileTreeIconKind, LucideIcon> = {
  folder: Folder,
  "folder-open": FolderOpen,
  image: FileImage,
  video: FilePlay,
  audio: FileMusic,
  document: FileText,
  archive: FileArchive,
  code: FileCode,
  file: File,
};

/** A folder or file icon, or the host's image from `getIcon`. */
export function FileTreeIconView({ icon }: { icon: FileTreeIcon }) {
  const Icon = ICONS[icon.kind] ?? File;
  return (
    <span aria-hidden="true" className="yayaw-ft-icon" data-kind={icon.kind}>
      {icon.src ? (
        <img alt={icon.alt ?? ""} height={18} src={icon.src} width={18} />
      ) : (
        <Icon />
      )}
    </span>
  );
}

/** The name with the search matches marked. */
export function FileTreeName({ name, query }: { name: string; query: string }) {
  const parts = highlightFileTreeName(name, query);
  let offset = 0;
  return (
    <span className="yayaw-ft-label" title={name}>
      {parts.map((part) => {
        const key = `${offset}`;
        offset += part.text.length;
        return part.match ? (
          <mark key={key}>{part.text}</mark>
        ) : (
          <span key={key}>{part.text}</span>
        );
      })}
    </span>
  );
}

/** Inline text field for renaming and for a new folder's name. */
export function FileTreeNameInput({
  error,
  initial,
  label,
  onCancel,
  onCommit,
}: {
  error?: string;
  initial: string;
  label: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = (value: string) => {
    if (!done.current) {
      done.current = true;
      onCommit(value);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onCancel();
    }
  };
  useEffect(() => {
    // A server error keeps the field open for another try.
    if (error) {
      done.current = false;
      ref.current?.focus();
    }
  }, [error]);
  return (
    <>
      <input
        aria-invalid={error ? true : undefined}
        aria-label={label}
        className="yayaw-ft-rename"
        defaultValue={initial}
        onBlur={(event) => commit(event.currentTarget.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        ref={ref}
      />
      {error ? (
        <span className="yayaw-ft-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Loading, empty, error, "Show more" and new-folder rows. */
export function FileTreeStatusRow({
  controller,
  label,
  row,
}: {
  controller: FileTreeController;
  label: Label;
  row: Exclude<FileTreeVisibleRow, { type: "node" }>;
}) {
  const style = { "--ft-level": indentLevel(row.level) } as React.CSSProperties;
  const content = (): ReactNode => {
    if (row.type === "more") {
      return (
        <button
          className="yayaw-ft-more"
          onClick={() => controller.loadMore(row.parentId)}
          tabIndex={-1}
          type="button"
        >
          {row.remaining
            ? label("showMore", { count: row.remaining })
            : label("showMoreUnknown")}
        </button>
      );
    }
    if (row.type === "draft") {
      return (
        <>
          <span className="yayaw-ft-spacer" />
          <FileTreeIconView icon={{ kind: "folder" }} />
          <FileTreeNameInput
            initial={label("newFolderName")}
            label={label("folderName")}
            onCancel={() => controller.cancelCreateFolder()}
            onCommit={(value) => {
              controller.commitCreateFolder(value).catch(() => undefined);
            }}
          />
        </>
      );
    }
    if (row.type === "error") {
      return <span className="yayaw-ft-error">{row.message}</span>;
    }
    return row.type === "loading" ? label("loading") : label("emptyFolder");
  };
  return (
    <div
      aria-level={row.level}
      className="yayaw-ft-row"
      data-filetree-status={row.type}
      role="row"
      style={style}
      tabIndex={row.type === "more" ? -1 : undefined}
      {...(row.type === "more" ? { "data-filetree-id": row.id } : {})}
    >
      <div
        className="yayaw-ft-cell yayaw-ft-name yayaw-ft-status"
        role="gridcell"
        style={{ gridColumn: "1 / -1" }}
      >
        <span className="yayaw-ft-spacer" />
        {content()}
      </div>
    </div>
  );
}

/** A native modal dialog, the same element in both editions. */
export function FileTreeDialog({
  children,
  className,
  describedBy,
  labelledBy,
  onClose,
  role,
}: {
  children: ReactNode;
  className?: string;
  describedBy?: string;
  labelledBy: string;
  onClose: () => void;
  role?: "alertdialog" | "dialog";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={`yayaw-ft-dialog ${className ?? ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={ref}
      role={role === "alertdialog" ? "alertdialog" : undefined}
    >
      {children}
    </dialog>
  );
}

/** "Move to…": a searchable tree of folders; invalid targets say why. */
export function FileTreeMoveDialog({
  controller,
  ids,
  label,
  onClose,
  version,
}: {
  controller: FileTreeController;
  ids: string[];
  label: Label;
  onClose: () => void;
  version: number;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = ids[0];
    const parent = first ? controller.parentOf(first) : null;
    return new Set(
      parent
        ? [
            ...controller
              .crumbs(parent)
              .flatMap((crumb) => (crumb.id ? [crumb.id] : [])),
          ]
        : []
    );
  });
  const [target, setTarget] = useState<string | null | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` changes when folders load.
  const rows = useMemo(
    () => controller.folderRows(expanded, query),
    [controller, expanded, query, version]
  );
  const title =
    ids.length === 1
      ? label("moveOneDialogTitle", { name: controller.name(ids[0] ?? "") })
      : label("moveDialogTitle", { count: ids.length });
  const reason =
    target === undefined ? undefined : controller.moveReason(ids, target);
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      controller.ensureChildren(id);
    }
    setExpanded(next);
  };
  const move = () => {
    if (target === undefined || reason) {
      return;
    }
    onClose();
    controller.move(ids, target).catch(() => undefined);
  };
  return (
    <FileTreeDialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <input
        aria-label={label("searchFolders")}
        className="yayaw-ft-dialog-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={label("searchFolders")}
        type="search"
        value={query}
      />
      <ul
        aria-label={label("folders", { count: rows.length })}
        className="yayaw-ft-folders"
      >
        {rows.map((row) => {
          const why = controller.moveReason(ids, row.id);
          const key = row.id ?? "__root";
          return (
            <li
              className="yayaw-ft-folder"
              key={key}
              style={{ "--ft-level": row.level } as React.CSSProperties}
            >
              {row.id !== null && row.hasChildren && !query ? (
                <button
                  aria-label={label(row.expanded ? "collapse" : "expand")}
                  className="yayaw-ft-toggle"
                  data-expanded={row.expanded}
                  onClick={() => toggle(row.id ?? "")}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              ) : (
                <span className="yayaw-ft-spacer" />
              )}
              <button
                aria-pressed={target === row.id}
                className="yayaw-ft-folder-button"
                disabled={Boolean(why)}
                onClick={() => setTarget(row.id)}
                onDoubleClick={() => {
                  if (!why) {
                    onClose();
                    controller.move(ids, row.id).catch(() => undefined);
                  }
                }}
                title={why}
                type="button"
              >
                <FileTreeIconView icon={{ kind: "folder" }} />
                <span>
                  {row.name}
                  {row.path ? <small> · {row.path}</small> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <footer>
        {reason ? <span className="yayaw-ft-error">{reason}</span> : null}
        <button className="yayaw-ft-button" onClick={onClose} type="button">
          {label("cancel")}
        </button>
        <button
          className="yayaw-ft-button"
          data-variant="primary"
          disabled={target === undefined || Boolean(reason)}
          onClick={move}
          type="button"
        >
          {label("moveHere")}
        </button>
      </footer>
    </FileTreeDialog>
  );
}

/** Confirmation before deleting; the host's delete action decides what happens to a folder's content. */
export function FileTreeDeleteDialog({
  controller,
  ids,
  label,
  onClose,
}: {
  controller: FileTreeController;
  ids: string[];
  label: Label;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const title =
    ids.length === 1
      ? label("deleteOneTitle", { name: controller.name(ids[0] ?? "") })
      : label("deleteTitle", { count: ids.length });
  return (
    <FileTreeDialog
      describedBy={descriptionId}
      labelledBy={titleId}
      onClose={onClose}
      role="alertdialog"
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{label("deleteDescription")}</p>
      <span />
      <footer>
        <button className="yayaw-ft-button" onClick={onClose} type="button">
          {label("cancel")}
        </button>
        <button
          className="yayaw-ft-button"
          data-variant="danger"
          onClick={() => {
            onClose();
            controller.remove(ids).catch(() => undefined);
          }}
          type="button"
        >
          {label("delete")}
        </button>
      </footer>
    </FileTreeDialog>
  );
}

/** The pane's left edge: drag it, or use the arrow keys. */
export function FileTreeResizeHandle({
  label,
  onWidth,
  width,
}: {
  label: string;
  onWidth: (width: number) => void;
  width: number;
}) {
  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={FILETREE_DETAILS_MAX}
      aria-valuemin={FILETREE_DETAILS_MIN}
      aria-valuenow={width}
      className="yayaw-ft-resize"
      onKeyDown={(event) => {
        const next = detailsWidthAfterKey(width, event.key);
        if (next !== undefined) {
          event.preventDefault();
          onWidth(next);
        }
      }}
      onPointerDown={(event) =>
        startDetailsResize(event.nativeEvent, width, onWidth)
      }
      role="separator"
      tabIndex={0}
    />
  );
}

export function FileTreeCloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="yayaw-ft-icon-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <X aria-hidden="true" />
    </button>
  );
}

export type { Row as FileTreeRowRecord };
