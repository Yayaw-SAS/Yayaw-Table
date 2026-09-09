import { appendFileSync } from "node:fs";
import { GitHubApi } from "./github-api.mjs";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RECOVERY =
  "Update a PR from current main, wait for its CI, then merge it without additional changes. Quality checks never run on main.";

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
        run.path === ".github/workflows/ci-tests.yml"
    )
    .sort((left, right) => right.id - left.id)[0];
  if (
    latest?.status !== "completed" ||
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
  const quality = jobs.filter((job) => job.name === "test-and-typecheck");
  if (
    quality.length !== 1 ||
    quality[0].status !== "completed" ||
    quality[0].conclusion !== "success"
  ) {
    throw new Error(
      `The latest test-and-typecheck job did not succeed. ${RECOVERY}`
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
    !Number.isSafeInteger(artifact.id) ||
    artifact.id <= 0 ||
    artifact.expired !== false ||
    !(Date.parse(artifact.expires_at) > now) ||
    !(artifact.size_in_bytes > 0) ||
    artifact.workflow_run?.id !== latest.id ||
    artifact.workflow_run?.head_sha !== head ||
    !DIGEST.test(artifact.digest)
  ) {
    throw new Error(
      `The validated Pages artifact for CI run ${latest.id}, attempt ${latest.run_attempt}, is missing, expired or inconsistent. Rerun that PR CI to recreate it, or open a fresh PR if the run predates artifact reuse. Do not build or test on main.`
    );
  }
  return {
    eligibility: "eligible",
    target_sha: target,
    head_sha: head,
    tree_sha: headCommit.commit.tree.sha,
    pr_number: String(pr.number),
    quality_run_id: String(latest.id),
    artifact_id: String(artifact.id),
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
      ? `Reusing PR #${result.pr_number}, CI run ${result.quality_run_id}, artifact ${result.artifact_id} for ${result.target_sha}. No tests or builds were repeated.`
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
