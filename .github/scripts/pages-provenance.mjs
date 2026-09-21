import { appendFileSync } from "node:fs";
import { GitHubApi } from "./github-api.mjs";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RECOVERY =
  "Update a PR from current main, wait for its CI, then merge it without additional changes. Quality checks never run on main.";
const QUALITY_WORKFLOW = ".github/workflows/ci-tests.yml";
const QUALITY_JOB = "test-and-typecheck";
const VERSION_WORKFLOW = ".github/workflows/version.yml";
const VERSION_JOB = "version";

/** Shared shape of a reusable artifact, whichever run preserved it. */
function usable(artifact, runId, now) {
  return Boolean(
    artifact &&
      Number.isSafeInteger(artifact.id) &&
      artifact.id > 0 &&
      artifact.expired === false &&
      Date.parse(artifact.expires_at) > now &&
      artifact.size_in_bytes > 0 &&
      artifact.workflow_run?.id === runId &&
      DIGEST.test(artifact.digest)
  );
}

/** The pull request's own CI run: the path every ordinary change takes. */
async function fromPullRequestCi(api, base, head, latest, now) {
  if (
    latest.status !== "completed" ||
    latest.conclusion !== "success" ||
    !Number.isSafeInteger(latest.id) ||
    !Number.isSafeInteger(latest.run_attempt) ||
    latest.run_attempt < 1
  ) {
    throw new Error(
      `The latest PR CI must have completed successfully. ${RECOVERY}`
    );
  }
  const { jobs } = await api.get(
    `${base}/actions/runs/${latest.id}/jobs?filter=latest&per_page=100`
  );
  const quality = jobs.filter((job) => job.name === QUALITY_JOB);
  if (
    quality.length !== 1 ||
    quality[0].status !== "completed" ||
    quality[0].conclusion !== "success"
  ) {
    throw new Error(
      `The latest ${QUALITY_JOB} job did not succeed. ${RECOVERY}`
    );
  }
  const { artifacts } = await api.get(
    `${base}/actions/runs/${latest.id}/artifacts?per_page=100`
  );
  const name = `registry-pages-${head}-${latest.run_attempt}`;
  const candidates = artifacts.filter((artifact) => artifact.name === name);
  const artifact = candidates[0];
  if (
    candidates.length !== 1 ||
    !usable(artifact, latest.id, now) ||
    artifact.workflow_run?.head_sha !== head
  ) {
    throw new Error(
      `The validated Pages artifact for CI run ${latest.id}, attempt ${latest.run_attempt}, is missing, expired or inconsistent. Rerun that PR CI to recreate it, or open a fresh PR if the run predates artifact reuse. Do not build or test on main.`
    );
  }
  return {
    source: "pull-request-ci",
    quality_run_id: String(latest.id),
    artifact_id: String(artifact.id),
  };
}

/**
 * The version workflow's own run, a safety net for the release branch.
 *
 * That branch is pushed by github-actions[bot], whose pushes produce a CI run
 * that waits for approval. This stands in only when the commit produced no CI
 * run at all; an unapproved or failed one is still refused by the caller, so
 * the net never rescues a release whose CI was not approved. The version
 * workflow runs the same gate on the exact tree it pushes and preserves the
 * tarball under a name pinned to the commit it just created. Its own head is
 * main, so only the artifact name binds it to this pull request; only a
 * workflow run can create that name, and version.yml runs only on main.
 */
async function fromVersionRun(api, base, head, now) {
  const name = `registry-pages-${head}`;
  const { artifacts } = await api.get(
    `${base}/actions/artifacts?name=${name}&per_page=100`
  );
  const candidates = (artifacts ?? []).filter(
    (artifact) => artifact.name === name
  );
  const artifact = candidates[0];
  const runId = artifact?.workflow_run?.id;
  if (
    candidates.length !== 1 ||
    !Number.isSafeInteger(runId) ||
    !usable(artifact, runId, now)
  ) {
    throw new Error(
      `The latest PR CI must have completed successfully, and no validated version artifact stands in for it. ${RECOVERY}`
    );
  }
  const source = await api.get(`${base}/actions/runs/${runId}`);
  if (
    source.path !== VERSION_WORKFLOW ||
    source.head_branch !== "main" ||
    source.status !== "completed" ||
    source.conclusion !== "success"
  ) {
    throw new Error(
      `Run ${runId} preserved this artifact but is not a successful version run on main. ${RECOVERY}`
    );
  }
  const { jobs } = await api.get(
    `${base}/actions/runs/${runId}/jobs?filter=latest&per_page=100`
  );
  const version = jobs.filter((job) => job.name === VERSION_JOB);
  if (
    version.length !== 1 ||
    version[0].status !== "completed" ||
    version[0].conclusion !== "success"
  ) {
    throw new Error(
      `The ${VERSION_JOB} job that validated this release did not succeed. ${RECOVERY}`
    );
  }
  return {
    source: "version-workflow",
    quality_run_id: String(runId),
    artifact_id: String(artifact.id),
  };
}

/** Authorize only the current main tree and its latest successful PR artifact. */
export async function authorizePages(
  api,
  repository,
  target,
  now = Date.now()
) {
  if (!(REPOSITORY.test(repository) && SHA.test(target))) {
    throw new Error(
      "Expected owner/repository and a full lowercase target SHA."
    );
  }
  const base = `repos/${repository}`;
  const main = await api.get(`${base}/commits/main`);
  if (main.sha !== target) {
    return { eligibility: "superseded", target_sha: target };
  }
  const prs = await api.get(`${base}/commits/${target}/pulls?per_page=100`);
  const matches = prs.filter(
    (pr) =>
      pr.merged_at &&
      pr.merge_commit_sha === target &&
      pr.base.ref === "main" &&
      pr.base.repo.full_name === repository
  );
  if (matches.length !== 1) {
    throw new Error(
      `Pages requires one merged PR for this commit. Direct pushes cannot publish. ${RECOVERY}`
    );
  }
  const pr = matches[0];
  const head = pr.head.sha;
  if (!SHA.test(head)) {
    throw new Error("The merged PR has an invalid head SHA.");
  }
  const [headCommit, mergedCommit] = await Promise.all([
    api.get(`${base}/commits/${head}`),
    api.get(`${base}/commits/${target}`),
  ]);
  if (
    headCommit.sha !== head ||
    mergedCommit.sha !== target ||
    !SHA.test(headCommit.commit.tree.sha) ||
    headCommit.commit.tree.sha !== mergedCommit.commit.tree.sha
  ) {
    throw new Error(
      `Merged content differs from PR #${pr.number}'s validated head. ${RECOVERY}`
    );
  }

  const { workflow_runs: runs } = await api.get(
    `${base}/actions/workflows/ci-tests.yml/runs?event=pull_request&head_sha=${head}&per_page=100`
  );
  // Never fall back to an older green run while a newer run is pending or failed.
  const latest = runs
    .filter(
      (run) =>
        run.event === "pull_request" &&
        run.head_sha === head &&
        run.path === QUALITY_WORKFLOW
    )
    .sort((left, right) => right.id - left.id)[0];
  // A pull request that ran CI is held to it. Only a branch that never ran any
  // falls back to the version workflow, so a red run can never be stepped over.
  const reused = latest
    ? await fromPullRequestCi(api, base, head, latest, now)
    : await fromVersionRun(api, base, head, now);
  return {
    eligibility: "eligible",
    target_sha: target,
    head_sha: head,
    tree_sha: headCommit.commit.tree.sha,
    pr_number: String(pr.number),
    ...reused,
  };
}

export async function run(
  api = new GitHubApi(process.env.GITHUB_TOKEN),
  env = process.env
) {
  const result = await authorizePages(
    api,
    env.GITHUB_REPOSITORY ?? "",
    env.TARGET_SHA ?? ""
  );
  if (
    result.eligibility === "eligible" &&
    env.EXPECTED_ARTIFACT_ID &&
    env.EXPECTED_ARTIFACT_ID !== result.artifact_id
  ) {
    throw new Error(
      "The validated artifact changed while publication was queued. Rerun this publication to resolve it again."
    );
  }
  if (env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(result)) {
      appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  }
  const summary =
    result.eligibility === "eligible"
      ? `Reusing PR #${result.pr_number}, ${result.source} run ${result.quality_run_id}, artifact ${result.artifact_id} for ${result.target_sha}. No tests or builds were repeated.`
      : `Skipping obsolete target ${result.target_sha}; Pages remains unchanged.`;
  console.log(summary);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`::error::${message}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `Pages publication blocked: ${message}\n`
      );
    }
    process.exitCode = 1;
  }
}
