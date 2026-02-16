// @ts-nocheck
import * as __fd_glob_14 from "../content/docs/url-state.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/troubleshooting.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/translations.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/setup.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/server-actions.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/query-integration.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/migration-query-client.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/installation.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/datatable.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/configuration.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/columns.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/bulk-actions.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/actions.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"actions.mdx": __fd_glob_1, "bulk-actions.mdx": __fd_glob_2, "columns.mdx": __fd_glob_3, "configuration.mdx": __fd_glob_4, "datatable.mdx": __fd_glob_5, "index.mdx": __fd_glob_6, "installation.mdx": __fd_glob_7, "migration-query-client.mdx": __fd_glob_8, "query-integration.mdx": __fd_glob_9, "server-actions.mdx": __fd_glob_10, "setup.mdx": __fd_glob_11, "translations.mdx": __fd_glob_12, "troubleshooting.mdx": __fd_glob_13, "url-state.mdx": __fd_glob_14, });