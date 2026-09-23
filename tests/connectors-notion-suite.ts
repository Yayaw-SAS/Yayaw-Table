import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/connectors/connector-model";
import type * as Notion from "../src/components/ui/yayaw-table/connectors/notion";
import {
  caught,
  fakeClock,
  fakeServer,
  json,
  networkFailure,
  type RecordedRequest,
  sequence,
} from "./connectors-fake-http";

type NotionApi = Pick<
  typeof Model,
  "ConnectorError" | "createConnectorHttp" | "retryDelay" | "toConnectorRows"
> &
  Pick<
    typeof Notion,
    | "defaultNotionMapping"
    | "getNotionDatabaseSchema"
    | "listNotionDatabases"
    | "normalizeNotionId"
    | "pushRowsToNotionDatabase"
    | "toNotionPropertyValue"
    | "toRichText"
    | "verifyNotionToken"
  >;

const DATABASE_ID = "0123456789abcdef0123456789abcdef";
const DATABASE_DASHED = "01234567-89ab-cdef-0123-456789abcdef";
const PAGE_ID = "fedcba98-7654-3210-fedc-ba9876543210";
const SECRET = "Confidential customer note";

const database = {
  id: DATABASE_DASHED,
  title: [{ plain_text: "Projects" }],
  url: "https://www.notion.so/projects",
  properties: {
    Name: { id: "title", name: "Name", type: "title" },
    "Yayaw ID": { id: "key:1", name: "Yayaw ID", type: "rich_text" },
    Status: {
      id: "st",
      name: "Status",
      type: "select",
      select: { options: [{ name: "Active", color: "green" }] },
    },
    Count: { id: "ct", name: "Count", type: "number" },
    Files: { id: "fl", name: "Files", type: "files" },
  },
};

const bot = { object: "user", type: "bot", id: "bot-1", name: "Sync", bot: {} };

function notionRoute(
  overrides: {
    createPage?: (request: RecordedRequest) => Response;
    updatePage?: (request: RecordedRequest) => Response;
  } = {}
) {
  return (request: RecordedRequest) => {
    const path = request.url.pathname;
    if (
      request.method === "GET" &&
      path === `/v1/databases/${DATABASE_DASHED}`
    ) {
      return json(database);
    }
    if (path === `/v1/databases/${DATABASE_DASHED}/query`) {
      return json({
        results: [
          {
            id: PAGE_ID,
            properties: { "Yayaw ID": { rich_text: [{ plain_text: "1" }] } },
          },
        ],
        has_more: false,
      });
    }
    if (request.method === "PATCH") {
      return overrides.updatePage?.(request) ?? json({ id: PAGE_ID });
    }
    if (request.method === "POST" && path === "/v1/pages") {
      return overrides.createPage?.(request) ?? json({ id: "new" });
    }
    return json({ message: "unexpected" }, 404);
  };
}

const writes = (requests: readonly RecordedRequest[]) =>
  requests.filter(
    (request) =>
      request.method === "PATCH" ||
      (request.method === "POST" && request.url.pathname === "/v1/pages")
  );

export function connectorsNotionSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: NotionApi
) {
  const options = (route: Parameters<typeof fakeServer>[0]) => {
    const server = fakeServer(route);
    const clock = fakeClock();
    return {
      server,
      clock,
      runtime: { fetch: server.fetch, now: clock.now, sleep: clock.sleep },
    };
  };

  test("verifies an integration token with Notion's version header", async () => {
    const { server, runtime } = options(() =>
      json({ ...bot, bot: { workspace_name: "Acme" } })
    );
    assert.deepEqual(await api.verifyNotionToken("secret_x", runtime), {
      botId: "bot-1",
      name: "Sync",
      workspaceName: "Acme",
    });
    const [request] = server.requests;
    assert.equal(request?.url.href, "https://api.notion.com/v1/users/me");
    assert.equal(request?.headers.Authorization, "Bearer secret_x");
    assert.equal(request?.headers["Notion-Version"], "2022-06-28");
  });

  test("honors Retry-After on 429 and caps it at 30 seconds", async () => {
    const { clock, runtime } = options(
      sequence(
        () => json({}, 429, { "retry-after": "2" }),
        () => json({}, 429, { "retry-after": "120" }),
        () => json(bot)
      )
    );
    await api.verifyNotionToken("secret_x", runtime);
    assert.deepEqual(clock.sleeps, [2000, 30_000]);
    assert.equal(api.retryDelay("Wed, 21 Oct 2015 07:28:10 GMT", 0, 0), 30_000);
    assert.equal(api.retryDelay(null, 2, 0), 2000);
  });

  test("retries 5xx and network failures with exponential backoff", async () => {
    const { clock, runtime } = options(
      sequence(
        () => json({}, 502),
        networkFailure,
        () => json(bot)
      )
    );
    await api.verifyNotionToken("secret_x", runtime);
    assert.deepEqual(clock.sleeps, [500, 1000]);
  });

  test("maps failures to typed codes without the provider body", async () => {
    const { runtime } = options(() =>
      json({ code: "unauthorized", message: SECRET }, 401)
    );
    const error = await caught(() => api.verifyNotionToken("bad", runtime));
    assert.ok(error instanceof api.ConnectorError);
    assert.equal(error.code, "unauthorized");
    assert.equal(error.details.status, 401);
    const serialized = `${error.message} ${JSON.stringify(error)} ${String(error.stack)}`;
    assert.equal(serialized.includes(SECRET), false);
  });

  test("gives up after the configured retries", async () => {
    const { runtime, server } = options(() => json({}, 503));
    const error = await caught(() =>
      api.verifyNotionToken("secret_x", { ...runtime, maxRetries: 2 })
    );
    assert.ok(error instanceof api.ConnectorError);
    assert.equal(error.code, "provider_unavailable");
    assert.equal(server.requests.length, 3);
  });

  test("spaces requests of one operation about three per second", async () => {
    const { clock, server } = options(() => json({}));
    const http = api.createConnectorHttp(
      { minIntervalMs: 334 },
      { fetch: server.fetch, now: clock.now, sleep: clock.sleep }
    );
    await http.request({ url: "https://api.notion.com/v1/a", method: "GET" });
    await http.request({ url: "https://api.notion.com/v1/b", method: "GET" });
    await http.request({ url: "https://api.notion.com/v1/c", method: "GET" });
    assert.deepEqual(clock.sleeps, [334, 334]);
  });

  test("lists databases across search pages", async () => {
    const { runtime, server } = options((request) => {
      const cursor = (request.body as { start_cursor?: string }).start_cursor;
      return cursor
        ? json({
            results: [{ object: "database", id: "db-2", title: [] }],
            has_more: false,
          })
        : json({
            results: [
              {
                object: "database",
                id: "db-1",
                title: [{ plain_text: "Tasks" }],
                url: "https://notion.so/db-1",
              },
              { object: "page", id: "page-1" },
            ],
            has_more: true,
            next_cursor: "next",
          });
    });
    assert.deepEqual(await api.listNotionDatabases("secret_x", runtime), [
      { id: "db-1", title: "Tasks", url: "https://notion.so/db-1" },
      { id: "db-2", title: "", url: null },
    ]);
    assert.equal(server.requests.length, 2);
  });

  test("reads a database schema with options", async () => {
    const { runtime } = options(notionRoute());
    const schema = await api.getNotionDatabaseSchema(
      "secret_x",
      `https://www.notion.so/acme/Projects-${DATABASE_ID}?v=1`,
      runtime
    );
    assert.equal(schema.title, "Projects");
    assert.deepEqual(
      schema.properties.find((property) => property.name === "Status"),
      {
        id: "st",
        name: "Status",
        type: "select",
        options: [{ name: "Active", color: "green" }],
      }
    );
  });

  test("accepts only Notion ids so an id cannot escape the API path", () => {
    assert.equal(api.normalizeNotionId(DATABASE_ID), DATABASE_DASHED);
    assert.equal(api.normalizeNotionId(DATABASE_DASHED), DATABASE_DASHED);
    for (const value of ["../users/me", `${DATABASE_ID}/../x`, "abc", ""]) {
      assert.throws(
        () => api.normalizeNotionId(value),
        (error: unknown) =>
          error instanceof api.ConnectorError && error.code === "invalid_target"
      );
    }
  });

  test("splits rich text in 2,000 character chunks without breaking emoji", () => {
    const text = `${"a".repeat(1999)}😀b`;
    const { items, truncated } = api.toRichText(text);
    assert.equal(truncated, false);
    assert.equal(items[0]?.text.content.length, 1999);
    assert.equal(items[1]?.text.content, "😀b");
    assert.equal(items.map((item) => item.text.content).join(""), text);
    const long = api.toRichText("x".repeat(2000 * 101));
    assert.equal(long.items.length, 100);
    assert.equal(long.truncated, true);
  });

  test("converts cells to Notion property values", () => {
    const property = (type: string, extra: object = {}) => ({
      id: type,
      name: type,
      type,
      ...extra,
    });
    assert.deepEqual(api.toNotionPropertyValue(property("number"), "1 200.5"), {
      ok: true,
      payload: { number: 1200.5 },
    });
    assert.deepEqual(
      api.toNotionPropertyValue(property("multi_select"), "a, b, a"),
      { ok: true, payload: { multi_select: [{ name: "a" }, { name: "b" }] } }
    );
    assert.deepEqual(
      api.toNotionPropertyValue(property("date"), "2026-09-03"),
      {
        ok: true,
        payload: { date: { start: "2026-09-03" } },
      }
    );
    assert.deepEqual(api.toNotionPropertyValue(property("checkbox"), "oui"), {
      ok: true,
      payload: { checkbox: true },
    });
    assert.equal(
      api.toNotionPropertyValue(property("url"), "javascript:alert(1)").ok,
      false
    );
    assert.equal(
      api.toNotionPropertyValue(
        property("status", { options: [{ name: "Done" }] }),
        "Unknown"
      ).ok,
      false
    );
    assert.deepEqual(api.toNotionPropertyValue(property("files"), "x"), {
      ok: false,
      reason: "unsupported_property_type",
    });
  });

  test("suggests a mapping by normalized name, then fills the title", () => {
    const mapping = api.defaultNotionMapping(
      [
        { id: "label", header: "Label", type: "text" },
        { id: "state", header: "statut", type: "select" },
        { id: "status", header: "STATUS", type: "select" },
        { id: "count", header: "Count", type: "date" },
        { id: "key", header: "Yayaw ID", type: "text" },
      ],
      { properties: Object.values(database.properties) }
    );
    assert.deepEqual(mapping, {
      keyProperty: "Yayaw ID",
      properties: { status: "Status", label: "Name" },
    });
    const special = api.defaultNotionMapping(
      [{ id: "__proto__", header: "Count", type: "constructor" }],
      { properties: Object.values(database.properties) }
    );
    assert.deepEqual(Object.entries(special.properties), [
      ["__proto__", "Name"],
    ]);
    const own = api.defaultNotionMapping(
      [{ id: "__proto__", header: "Count", type: "number" }],
      { properties: Object.values(database.properties) }
    );
    assert.deepEqual(Object.entries(own.properties), [["__proto__", "Count"]]);
  });

  test("upserts pages keyed by the Yayaw ID property", async () => {
    const { runtime, server } = options(notionRoute());
    const rows = api.toConnectorRows([
      { id: 1, label: "Existing", status: "Active", count: "4" },
      { id: "2", label: "New", status: "Paused", count: 5, files: "a" },
      { id: "2", label: "Duplicate" },
      { label: "No id" },
    ]);
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: {
          properties: {
            label: "Name",
            status: "Status",
            count: "Count",
            files: "Files",
            gone: "Missing",
          },
        },
        rows,
      },
      runtime
    );
    assert.equal(result.updated, 1);
    assert.equal(result.created, 1);
    assert.equal(result.skipped, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.truncated, false);
    assert.deepEqual(result.warnings.map((warning) => warning.reason).sort(), [
      "duplicate_row",
      "invalid_row_id",
      "property_missing",
      "unsupported_property_type",
    ]);
    const query = server.requests.find((request) =>
      request.url.pathname.endsWith("/query")
    );
    assert.equal(query?.url.searchParams.get("filter_properties"), "key:1");
    const [update, create] = writes(server.requests);
    assert.equal(update?.method, "PATCH");
    assert.equal(update?.url.pathname, `/v1/pages/${PAGE_ID}`);
    assert.deepEqual(update?.body, {
      properties: {
        "Yayaw ID": { rich_text: [{ type: "text", text: { content: "1" } }] },
        Name: { title: [{ type: "text", text: { content: "Existing" } }] },
        Status: { select: { name: "Active" } },
        Count: { number: 4 },
      },
    });
    assert.deepEqual((create?.body as { parent: unknown }).parent, {
      database_id: DATABASE_DASHED,
    });
  });

  test("records a failing row and keeps pushing the others", async () => {
    const { runtime, server } = options(
      notionRoute({
        createPage: (request) =>
          JSON.stringify(request.body).includes("bad")
            ? json({ message: SECRET }, 400)
            : json({ id: "new" }),
      })
    );
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: { properties: { label: "Name" } },
        rows: api.toConnectorRows([
          { id: "a", label: "bad" },
          { id: "b", label: "good" },
        ]),
      },
      runtime
    );
    assert.equal(result.created, 1);
    assert.equal(result.failed, 1);
    assert.deepEqual(result.failures, [
      { code: "invalid_request", rowId: "a", rows: 1 },
    ]);
    assert.equal(JSON.stringify(result).includes(SECRET), false);
    assert.equal(writes(server.requests).length, 2);
  });

  test("never retries page creation after an ambiguous failure", async () => {
    let attempts = 0;
    const { runtime } = options(
      notionRoute({
        createPage: () => {
          attempts += 1;
          return attempts === 1 ? networkFailure() : json({}, 500);
        },
      })
    );
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: { properties: {} },
        rows: api.toConnectorRows([{ id: "a" }, { id: "b" }]),
      },
      runtime
    );
    assert.equal(attempts, 2);
    assert.deepEqual(
      result.failures.map((failure) => failure.code),
      ["provider_unavailable", "provider_unavailable"]
    );
  });

  test("retries page creation on 429 and updates on 5xx", async () => {
    let creates = 0;
    let updates = 0;
    const { runtime } = options(
      notionRoute({
        createPage: () => {
          creates += 1;
          return creates === 1 ? json({}, 429) : json({ id: "new" });
        },
        updatePage: () => {
          updates += 1;
          return updates === 1 ? json({}, 503) : json({ id: PAGE_ID });
        },
      })
    );
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: { properties: {} },
        rows: api.toConnectorRows([{ id: "1" }, { id: "2" }]),
      },
      runtime
    );
    assert.deepEqual([result.updated, result.created], [1, 1]);
    assert.deepEqual([updates, creates], [2, 2]);
  });

  test("stops the push when the token is revoked", async () => {
    const { runtime, server } = options(
      notionRoute({ updatePage: () => json({ message: SECRET }, 401) })
    );
    const error = await caught(() =>
      api.pushRowsToNotionDatabase(
        {
          token: "secret_x",
          databaseId: DATABASE_ID,
          mapping: { properties: {} },
          rows: api.toConnectorRows([{ id: "1" }, { id: "2" }]),
        },
        runtime
      )
    );
    assert.ok(error instanceof api.ConnectorError);
    assert.equal(error.code, "unauthorized");
    assert.equal(writes(server.requests).length, 1);
  });

  test("refuses a key property that cannot hold row ids", async () => {
    const { runtime } = options(notionRoute());
    const error = await caught(() =>
      api.pushRowsToNotionDatabase(
        {
          token: "secret_x",
          databaseId: DATABASE_ID,
          mapping: { keyProperty: "Status", properties: {} },
          rows: [],
        },
        runtime
      )
    );
    assert.ok(error instanceof api.ConnectorError);
    assert.equal(error.code, "invalid_mapping");
  });

  test("pushes at most maxRows rows and reports the truncation", async () => {
    const { runtime, server } = options(notionRoute());
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: { keyProperty: "Count", properties: {} },
        maxRows: 2,
        rows: api.toConnectorRows([
          { id: "x" },
          { id: 10 },
          { id: 11 },
          { id: 12 },
        ]),
      },
      runtime
    );
    assert.equal(result.truncated, true);
    assert.equal(result.skipped, 1);
    assert.equal(result.created, 2);
    assert.equal(writes(server.requests).length, 2);
    assert.ok(
      result.warnings.some((warning) => warning.reason === "row_limit")
    );
  });
}
