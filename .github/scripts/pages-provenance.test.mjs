import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GitHubApi } from "./github-api.mjs";
import { authorizePages, run } from "./pages-provenance.mjs";

const DIRECT_PUSH = /Direct pushes cannot publish/;
const MERGED_PR = /requires one merged PR/;
const TREE_MISMATCH = /Merged content differs/;
const LATEST_CI = /latest PR CI/;
const PERMISSIONS = /HTTP 403.*permissions/;
const RETRY_LIMIT = /three attempts/;
const target = "a".repeat(40);
const head = "b".repeat(40);
const tree = "c".repeat(40);
const repository = "Yayaw-SAS/Yayaw-Table";
const base = `repos/${repository}`;
const now = Date.parse("2026-09-09T00:00:00Z");
const paths = {
  main: `${base}/commits/main`,
  prs: `${base}/commits/${target}/pulls?per_page=100`,
  head: `${base}/commits/${head}`,
  target: `${base}/commits/${target}`,
  runs: `${base}/actions/workflows/ci-tests.yml/runs?event=pull_request&head_sha=${head}&per_page=100`,
  jobs: `${base}/actions/runs/100/jobs?filter=latest&per_page=100`,
  artifacts: `${base}/actions/runs/100/artifacts?per_page=100`,
};

function fixture() {
  const data = {
    [paths.main]: { sha: target },
    [paths.prs]: [
      {
        number: 131,
        merged_at: "2026-09-09T00:00:00Z",
        merge_commit_sha: target,
        base: { ref: "main", repo: { full_name: repository } },
        head: { sha: head, repo: { full_name: repository } },
      },
    ],
    [paths.head]: { sha: head, commit: { tree: { sha: tree } } },
    [paths.target]: { sha: target, commit: { tree: { sha: tree } } },
    [paths.runs]: {
      workflow_runs: [
        {
          id: 100,
          run_attempt: 2,
          event: "pull_request",
          head_sha: head,
          path: ".github/workflows/ci-tests.yml",
          status: "completed",
          conclusion: "success",
        },
      ],
    },
    [paths.jobs]: {
      jobs: [
        {
          name: "test-and-typecheck",
          status: "completed",
          conclusion: "success",
        },
      ],
    },
    [paths.artifacts]: {
      artifacts: [
        {
          id: 900,
          name: `registry-pages-${head}-2`,
          expired: false,
          expires_at: "2026-10-09T00:00:00Z",
          size_in_bytes: 1000,
          digest: `sha256:${"d".repeat(64)}`,
          workflow_run: { id: 100, head_sha: head },
        },
      ],
    },
  };
  const calls = [];
  const api = {
    get(path) {
      calls.push(path);
      if (!Object.hasOwn(data, path)) {
        throw new Error(`Unexpected API request: ${path}`);
      }
      return Promise.resolve(structuredClone(data[path]));
    },
  };
  return { data, calls, api };
}

function authorize(f) {
  return authorizePages(f.api, repository, target, now);
}

test("a merged tree reuses the latest successful PR attempt and immutable artifact", async () => {
  const result = await authorize(fixture());
  assert.deepEqual(result, {
    eligibility: "eligible",
    target_sha: target,
    head_sha: head,
    tree_sha: tree,
    pr_number: "131",
    quality_run_id: "100",
    artifact_id: "900",
  });
});

test("an obsolete target exits before resolving artifacts or authorizing publication", async () => {
  const f = fixture();
  f.data[paths.main].sha = "e".repeat(40);
  assert.deepEqual(await authorize(f), {
    eligibility: "superseded",
    target_sha: target,
  });
  assert.deepEqual(f.calls, [paths.main]);
});

test("direct pushes cannot publish even if a successful CI exists", async () => {
  const f = fixture();
  f.data[paths.prs] = [];
  await assert.rejects(authorize(f), DIRECT_PUSH);
  assert.equal(f.calls.includes(paths.runs), false);
});

test("ambiguous merged PR association fails closed", async () => {
  const f = fixture();
  f.data[paths.prs].push(structuredClone(f.data[paths.prs][0]));
  await assert.rejects(authorize(f), MERGED_PR);
});

test("a fork PR merged into this repository can reuse its validated artifact", async () => {
  const f = fixture();
  f.data[paths.prs][0].head.repo.full_name = "contributor/Yayaw-Table";
  assert.equal((await authorize(f)).artifact_id, "900");
});

test("unvalidated merge content is rejected before pending CI can obscure the cause", async () => {
  const f = fixture();
  f.data[paths.target].commit.tree.sha = "e".repeat(40);
  f.data[paths.runs].workflow_runs[0].status = "in_progress";
  await assert.rejects(authorize(f), TREE_MISMATCH);
  assert.equal(f.calls.includes(paths.runs), false);
});

for (const [name, change] of [
  [
    "wrong base",
    (f) => {
      f.data[paths.prs][0].base.ref = "development";
    },
  ],
  [
    "wrong base repository",
    (f) => {
      f.data[paths.prs][0].base.repo.full_name = "other/repo";
    },
  ],
  [
    "unmerged PR",
    (f) => {
      f.data[paths.prs][0].merged_at = null;
    },
  ],
  [
    "different merge commit",
    (f) => {
      f.data[paths.prs][0].merge_commit_sha = head;
    },
  ],
  [
    "wrong head returned by API",
    (f) => {
      f.data[paths.head].sha = target;
    },
  ],
  [
    "CI for another head",
    (f) => {
      f.data[paths.runs].workflow_runs[0].head_sha = target;
    },
  ],
  [
    "CI from another workflow",
    (f) => {
      f.data[paths.runs].workflow_runs[0].path = ".github/workflows/other.yml";
    },
  ],
  [
    "push CI instead of PR CI",
    (f) => {
      f.data[paths.runs].workflow_runs[0].event = "push";
    },
  ],
  [
    "missing quality job",
    (f) => {
      f.data[paths.jobs].jobs = [];
    },
  ],
  [
    "skipped quality job",
    (f) => {
      f.data[paths.jobs].jobs[0].conclusion = "skipped";
    },
  ],
  [
    "failed quality job",
    (f) => {
      f.data[paths.jobs].jobs[0].conclusion = "failure";
    },
  ],
  [
    "missing artifact",
    (f) => {
      f.data[paths.artifacts].artifacts = [];
    },
  ],
  [
    "artifact from the previous attempt",
    (f) => {
      f.data[paths.artifacts].artifacts[0].name = `registry-pages-${head}-1`;
    },
  ],
  [
    "expired artifact",
    (f) => {
      f.data[paths.artifacts].artifacts[0].expired = true;
    },
  ],
  [
    "artifact past its retention time",
    (f) => {
      f.data[paths.artifacts].artifacts[0].expires_at = "2026-09-08T00:00:00Z";
    },
  ],
  [
    "artifact with another source run",
    (f) => {
      f.data[paths.artifacts].artifacts[0].workflow_run.id = 99;
    },
  ],
  [
    "artifact with another source head",
    (f) => {
      f.data[paths.artifacts].artifacts[0].workflow_run.head_sha = target;
    },
  ],
  [
    "artifact without a digest",
    (f) => {
      f.data[paths.artifacts].artifacts[0].digest = undefined;
    },
  ],
  [
    "empty artifact",
    (f) => {
      f.data[paths.artifacts].artifacts[0].size_in_bytes = 0;
    },
  ],
]) {
  test(`${name} cannot authorize publication`, async () => {
    const f = fixture();
    change(f);
    await assert.rejects(authorize(f));
  });
}

for (const conclusion of ["failure", "cancelled", null]) {
  test(`the latest ${conclusion ?? "pending"} CI cannot fall back to an older success`, async () => {
    const f = fixture();
    const latest = f.data[paths.runs].workflow_runs[0];
    f.data[paths.runs].workflow_runs.push({ ...latest, id: 99 });
    latest.conclusion = conclusion;
    latest.status = conclusion === null ? "in_progress" : "completed";
    await assert.rejects(authorize(f), LATEST_CI);
  });
}

test("GitHub 403 explains permissions and is not retried", async () => {
  let requests = 0;
  const api = new GitHubApi(
    "test-token",
    () => {
      requests += 1;
      return Promise.resolve(new Response("forbidden", { status: 403 }));
    },
    () => assert.fail("403 must not retry")
  );
  await assert.rejects(api.get("repos/example/repo"), PERMISSIONS);
  assert.equal(requests, 1);
});

test("GitHub retries transient read failures with bounded requests", async () => {
  const responses = [503, 429, 200];
  const delays = [];
  const api = new GitHubApi(
    "test-token",
    (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, "Bearer test-token");
      return Promise.resolve(new Response("{}", { status: responses.shift() }));
    },
    (ms) => {
      delays.push(ms);
    }
  );
  assert.deepEqual(await api.get("repos/example/repo"), {});
  assert.deepEqual(delays, [2000, 4000]);
});

test("a persistent network failure stops after three attempts", async () => {
  let requests = 0;
  const api = new GitHubApi(
    "test-token",
    () => {
      requests += 1;
      return Promise.reject(new Error("connection reset"));
    },
    () => undefined
  );
  await assert.rejects(api.get("repos/example/repo"), RETRY_LIMIT);
  assert.equal(requests, 3);
});

test("an invalid JSON response fails without retrying or authorizing publication", async () => {
  const api = new GitHubApi(
    "test-token",
    () => Promise.resolve(new Response("invalid JSON")),
    () => assert.fail("invalid JSON must not retry")
  );
  await assert.rejects(api.get("repos/example/repo"));
});

// biome-ignore lint/style/noDoneCallback: Node passes a TestContext for cleanup, not a done callback.
test("a changed artifact at the final recheck issues no deployment eligibility", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "table-ci-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, "output");
  const f = fixture();
  f.data[paths.artifacts].artifacts[0].expires_at = new Date(
    Date.now() + 86_400_000
  ).toISOString();
  await assert.rejects(
    run(f.api, {
      GITHUB_REPOSITORY: repository,
      TARGET_SHA: target,
      EXPECTED_ARTIFACT_ID: "899",
      GITHUB_OUTPUT: output,
    }),
    {
      message:
        "The validated artifact changed while publication was queued. Rerun this publication to resolve it again.",
    }
  );
  assert.equal(existsSync(output), false);
});

// biome-ignore lint/style/noDoneCallback: Node passes a TestContext for cleanup, not a done callback.
test("a superseded queued target emits only the successful no-op outputs", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "table-ci-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, "output");
  const f = fixture();
  f.data[paths.main].sha = head;
  await run(f.api, {
    GITHUB_REPOSITORY: repository,
    TARGET_SHA: target,
    GITHUB_OUTPUT: output,
  });
  assert.equal(
    readFileSync(output, "utf8"),
    `eligibility=superseded\ntarget_sha=${target}\n`
  );
});

test("the real Node CLI entrypoint fails closed without its token", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("./pages-provenance.mjs", import.meta.url).pathname],
    {
      env: { ...process.env, GITHUB_TOKEN: "", GITHUB_STEP_SUMMARY: "" },
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("GITHUB_TOKEN is required"));
});
