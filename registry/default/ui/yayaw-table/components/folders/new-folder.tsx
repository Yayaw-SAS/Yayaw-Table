"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fileTreeHooksOf,
  useFolderDirectory,
} from "../../hooks/use-folder-directory";
import { useTableConfig } from "../../hooks/use-table-config";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import {
  useTableActions,
  useTranslations,
} from "../../providers/table-provider";
import {
  type FileTreeLabelKey,
  fileTreeLabel,
} from "../../utils/filetree-model";
import {
  canCreateFolderUnder,
  createFolderRecord,
  defaultNewFolderParent,
  type FolderCreation,
  folderTableOptions,
  folderTreeOf,
  newFolderName,
  newFolderShownIn,
  rootFolderLabel,
} from "../../utils/folder-directory";
import { formSubmitResultFrom } from "../../utils/form-view";
import { TableTooltip } from "../../utils/table-tooltip";
import { translateWithFallback } from "../filters/i18n-utils";
import { FolderPicker } from "./folder-picker";

function useFolderLabels() {
  const { locale, t } = useTranslations();
  const translate = useCallback(
    (key: string, fallback: string) =>
      translateWithFallback(t, `filetree.${key}`, fallback),
    [t]
  );
  const label = useCallback(
    (key: FileTreeLabelKey, params?: Record<string, number | string>) =>
      fileTreeLabel(key, locale, translate, params),
    [locale, translate]
  );
  return { label, locale, translate };
}

/**
 * "New folder" with its parent chosen in a searchable list of the table's
 * folders; the name follows the File tree's rule (trimmed, else "New
 * folder") and the host's errors stay in the dialog.
 */
function NewFolderDialog({
  creation,
  defaultParent,
  onClose,
  tableId,
  tableType,
}: {
  creation: FolderCreation;
  defaultParent: string | null;
  onClose: () => void;
  tableId: string;
  tableType: string;
}) {
  const queryClient = useQueryClient();
  const { label, locale, translate } = useFolderLabels();
  const { directory, loading, tree } = useFolderDirectory({
    tableId,
    tableType,
  });
  const nameId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => label("newFolderName"));
  const [parent, setParent] = useState<string | null>(defaultParent);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    input.current?.select();
  }, []);
  const rootLabel = rootFolderLabel(locale, translate);
  const submit = async () => {
    if (!tree || busy) {
      return;
    }
    const folderName = newFolderName(name, locale, translate);
    setBusy(true);
    setError(undefined);
    try {
      await createFolderRecord({
        ...creation,
        settings: tree,
        parentId: parent,
        name: folderName,
        failure: label("createFailed"),
      });
      toast.success(label("created", { name: folderName }));
      await queryClient.invalidateQueries({ queryKey: ["tableData", tableId] });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : label("createFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="sm:max-w-md" data-new-folder-dialog="">
        <DialogHeader>
          <DialogTitle>{label("newFolder")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit().catch(() => undefined);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm" htmlFor={nameId}>
              {label("folderName")}
            </label>
            <input
              aria-invalid={error ? true : undefined}
              className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-new-folder-name=""
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              ref={input}
              value={name}
            />
          </div>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 font-medium text-sm">
              {label("parentFolder")}
            </legend>
            <FolderPicker
              directory={directory}
              disabled={(entry) =>
                !canCreateFolderUnder(entry?.row ?? null, creation)
              }
              emptyLabel={label("noFolders")}
              label={label("parentFolder")}
              loading={loading}
              loadingLabel={label("loading")}
              onPick={setParent}
              rootLabel={rootLabel}
              searchLabel={label("searchFolders")}
              selected={(id) => id === parent}
            />
          </fieldset>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              {label("cancel")}
            </Button>
            <Button data-new-folder-create="" disabled={busy} type="submit">
              {label("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "New folder" in the toolbar of the views other than the File tree, for
 * tables whose rows form a file tree and that can create folders
 * (`actions.tree.createFolder`, else `create`), unless
 * `table.filetree.newFolderAction` is false.
 */
export function NewFolderButton({
  actionsAsIcons,
  compact,
  tableId,
  tableType,
}: {
  actionsAsIcons: boolean;
  compact: boolean;
  tableId: string;
  tableType: string;
}) {
  const { config } = useTableConfig(tableType);
  const getTableActions = useTableActions();
  const { label } = useFolderLabels();
  const state = useTableUrlState({
    defaultDisplayMode: config.table.defaultDisplayMode,
    enabled: config.table.syncUrl !== false,
    tableId,
  });
  const [open, setOpen] = useState(false);
  const actions = getTableActions?.(tableType);
  const tree = folderTreeOf(config.table.filetree, config.columns.definitions);
  const create = actions?.create;
  const canCreate =
    config.table.allowCreate !== false && typeof create === "function";
  const creation: FolderCreation = {
    tree: actions?.tree,
    canCreate,
    createRecord: create
      ? async (values) => {
          const result = formSubmitResultFrom(await create(values));
          return result.ok
            ? { success: true }
            : { success: false, error: result.message };
        }
      : undefined,
    hooks: fileTreeHooksOf(config.table.filetree),
  };
  const available =
    tree &&
    folderTableOptions(config.table.filetree).newFolderAction &&
    newFolderShownIn(state.displayModeParam) &&
    Boolean(
      creation.tree?.createFolder ?? (canCreate && creation.createRecord)
    );
  if (!(tree && available)) {
    return null;
  }
  const text = label("newFolder");
  const iconOnly = compact || actionsAsIcons;
  // Phones get 44px touch targets, like the toolbar's other icon buttons.
  const iconSize = compact ? "size-11" : "h-8 w-8";
  const trigger = (
    <Button
      aria-label={iconOnly ? text : undefined}
      className={iconOnly ? iconSize : "h-8 gap-2 px-3 font-normal text-xs"}
      data-new-folder=""
      onClick={() => setOpen(true)}
      size={iconOnly ? "icon-sm" : "sm"}
      type="button"
      variant="outline"
    >
      <FolderPlus className="size-4" />
      {iconOnly ? null : <span>{text}</span>}
    </Button>
  );
  return (
    <>
      {iconOnly ? <TableTooltip label={text}>{trigger}</TableTooltip> : trigger}
      {open ? (
        <NewFolderDialog
          creation={creation}
          defaultParent={defaultNewFolderParent(
            state.advancedFiltersParam,
            tree.parentColumn
          )}
          onClose={() => setOpen(false)}
          tableId={tableId}
          tableType={tableType}
        />
      ) : null}
    </>
  );
}
