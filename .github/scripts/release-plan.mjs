import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Decides the one step main owes the registry, so releasing needs no local run.
 *
 * Pending changesets mean the next release is not described yet: open or refresh
 * the version pull request. An already described version that carries no tag is
 * ready to publish. Anything else is already released.
 *
 * Pages refuses a commit that is not the merge of a single pull request, so the
 * version bump is never pushed to main directly; only the tag is.
 */
export function planRelease({ pending, version, tags }) {
  if (!SEMVER.test(version ?? "")) {
    throw new Error(
      `Expected a semantic version in package.json, got ${JSON.stringify(version)}.`
    );
  }
  if (pending.length > 0) {
    return {
      action: "version",
      pending: pending.length,
      reason: `${pending.length} changeset(s) describe an unreleased change.`,
    };
  }
  const tag = `v${version}`;
  if (tags.includes(tag)) {
    return { action: "none", reason: `${tag} is already released.` };
  }
  return {
    action: "tag",
    tag,
    reason: `${tag} is described and untagged, so it is ready to publish.`,
  };
}

/** Changeset entries, using the same filter as the repository's validator. */
export function pendingChangesets(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
}

function main() {
  const root = resolve(process.argv[2] ?? ".");
  const plan = planRelease({
    pending: pendingChangesets(resolve(root, ".changeset")),
    version: JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
      .version,
    tags: (process.env.RELEASE_TAGS ?? "").split("\n").filter(Boolean),
  });
  console.log(`${plan.action}: ${plan.reason}`);
  return plan;
}

if (process.argv[1]?.endsWith("release-plan.mjs")) {
  const plan = main();
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      output,
      `action=${plan.action}\ntag=${plan.tag ?? ""}\nreason=${plan.reason}\n`
    );
  }
}
