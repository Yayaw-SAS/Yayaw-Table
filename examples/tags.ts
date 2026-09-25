import {
  catalogAfterMerge,
  catalogAfterRemove,
  catalogAfterUpdate,
  cleanTagName,
  findTagByName,
  mergeTagValue,
  removeTagValue,
  type TableTag,
  type TableTagActions,
} from "../src/components/ui/yayaw-table/utils/tag-catalog";

/** What the demo host remembers of each tag call, read by the end-to-end tests. */
export interface TagRequest {
  action: "create" | "list" | "merge" | "remove" | "update";
  columnId: string;
}

/**
 * An in-memory tag catalog, shared by the React and Vue demos: `actions.tags`
 * for one tags field of `records`. Merges and deletions rewrite the records
 * with the shared helpers, as a server would.
 */
export function createTagStore(options: {
  seed: TableTag[];
  records: () => Record<string, unknown>[];
  field: string;
  log?: (request: TagRequest) => void;
}): TableTagActions {
  let tags = options.seed.map((tag) => ({ ...tag }));
  let created = 0;
  const copy = () => tags.map((tag) => ({ ...tag }));
  const rewrite = (map: (value: unknown) => unknown) => {
    for (const record of options.records()) {
      record[options.field] = map(record[options.field]);
    }
  };
  const nameTaken = (name: string, except?: string) => {
    const other = findTagByName(
      tags.filter((tag) => tag.id !== except),
      name
    );
    return other ? `A tag named “${other.name}” already exists.` : undefined;
  };
  return {
    list: ({ columnId }) => {
      options.log?.({ action: "list", columnId });
      return Promise.resolve(copy());
    },
    create: ({ columnId, name, color }) => {
      options.log?.({ action: "create", columnId });
      const error = nameTaken(name);
      if (error) {
        return Promise.resolve({ success: false, error });
      }
      created += 1;
      const tag: TableTag = {
        id: `tag-new-${created}`,
        name: cleanTagName(name),
        ...(color ? { color } : {}),
      };
      tags = [...tags, tag];
      return Promise.resolve({ success: true, data: { ...tag } });
    },
    update: ({ columnId, id, name, color }) => {
      options.log?.({ action: "update", columnId });
      const error = name === undefined ? undefined : nameTaken(name, id);
      if (error) {
        return Promise.resolve({ success: false, error });
      }
      tags = catalogAfterUpdate(tags, id, { name, color });
      return Promise.resolve({ success: true });
    },
    merge: ({ columnId, sourceIds, targetId }) => {
      options.log?.({ action: "merge", columnId });
      rewrite((value) => mergeTagValue(value, sourceIds, targetId));
      tags = catalogAfterMerge(tags, sourceIds, targetId);
      return Promise.resolve({ success: true });
    },
    remove: ({ columnId, id }) => {
      options.log?.({ action: "remove", columnId });
      rewrite((value) => removeTagValue(value, id));
      tags = catalogAfterRemove(tags, id);
      return Promise.resolve({ success: true });
    },
  };
}
