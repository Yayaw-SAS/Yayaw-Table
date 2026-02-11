// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"actions.mdx": () => import("../content/docs/actions.mdx?collection=docs"), "columns.mdx": () => import("../content/docs/columns.mdx?collection=docs"), "configuration.mdx": () => import("../content/docs/configuration.mdx?collection=docs"), "datatable.mdx": () => import("../content/docs/datatable.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "installation.mdx": () => import("../content/docs/installation.mdx?collection=docs"), "server-actions.mdx": () => import("../content/docs/server-actions.mdx?collection=docs"), "setup.mdx": () => import("../content/docs/setup.mdx?collection=docs"), "translations.mdx": () => import("../content/docs/translations.mdx?collection=docs"), "url-state.mdx": () => import("../content/docs/url-state.mdx?collection=docs"), }),
};
export default browserCollections;