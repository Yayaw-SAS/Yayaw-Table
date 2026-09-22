import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { changedReleaseInputs } from "./release-inputs.mjs";

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/** `type(scope)!: subject`, the convention every commit on main already follows. */
const CONVENTIONAL =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s+\S/;
const BUMP_BY_TYPE = {
  feat: "minor",
  fix: "patch",
  perf: "patch",
  refactor: "patch",
  revert: "patch",
};
/** Types that ship nothing to a consumer, so they never move the version. */
const SILENT_TYPES = new Set(["build", "chore", "ci", "docs", "style", "test"]);
const RANK = { patch: 1, minor: 2, major: 3 };

/**
 * The version a set of commit subjects asks for, or undefined for none.
 *
 * A subject that does not follow the convention is never guessed at: it is
 * reported so the release names it instead of silently shipping nothing.
 */
export function conventionalBump(subjects) {
  let bump;
  const unconventional = [];
  const raise = (candidate) => {
    if (!bump || RANK[candidate] > RANK[bump]) {
      bump = candidate;
    }
  };
  for (const subject of subjects) {
    const groups = CONVENTIONAL.exec(subject)?.groups;
    if (!groups) {
      unconventional.push(subject);
      continue;
    }
    if (groups.breaking) {
      raise("major");
      continue;
    }
    const candidate = BUMP_BY_TYPE[groups.type];
    if (candidate) {
      raise(candidate);
      continue;
    }
    // A known type that ships nothing is silent; an unknown one is never guessed.
    if (!SILENT_TYPES.has(groups.type)) {
      unconventional.push(subject);
    }
  }
  return { bump, unconventional };
}

/**
 * Decides the one step main owes the registry, so releasing needs no local run.
 *
 * Work is described either by a changeset or by the conventional commits merged
 * since the last tag; a changeset always wins, because its prose is better than
 * a derived summary. A described version that carries no tag is ready to
 * publish, and anything else is already released.
 *
 * Pages refuses a commit that is not the merge of a single pull request, so the
 * version bump is never pushed to main directly; only the tag is.
 */
export function planRelease({
  pending,
  version,
  tags,
  commits = [],
  changedFiles = [],
}) {
  if (!SEMVER.test(version ?? "")) {
    throw new Error(
      `Expected a semantic version in package.json, got ${JSON.stringify(version)}.`
    );
  }
  const derived = conventionalBump(commits);
  if (pending.length > 0) {
    return {
      action: "version",
      source: "changesets",
      pending: pending.length,
      unconventional: derived.unconventional,
      reason: `${pending.length} changeset(s) describe an unreleased change.`,
    };
  }
  const tag = `v${version}`;
  // Publishing comes before describing the next release. The commits behind an
  // untagged version are the work that version already carries, and the tag
  // they would be measured from is precisely the one that does not exist yet,
  // so deriving a bump here would release the same work twice and never tag.
  if (!tags.includes(tag)) {
    return {
      action: "tag",
      tag,
      unconventional: derived.unconventional,
      reason: `${tag} is described and untagged, so it is ready to publish.`,
    };
  }
  if (derived.bump || changedFiles.length > 0) {
    const bump = derived.bump ?? "patch";
    return {
      action: "version",
      source: "commits",
      bump,
      pending: 0,
      unconventional: derived.unconventional,
      reason: derived.bump
        ? `Conventional commits ask for a ${bump} release.`
        : `${changedFiles.length} distribution file(s) changed; a patch release is required.`,
    };
  }
  return {
    action: "none",
    unconventional: derived.unconventional,
    reason: `${tag} is already released.`,
  };
}

/** Changeset entries, using the same filter as the repository's validator. */
export function pendingChangesets(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
}

/** True for a commit that ships something to a consumer, so it belongs in the changelog. */
function isReleasable(subject) {
  const groups = CONVENTIONAL.exec(subject)?.groups;
  return Boolean(groups && (groups.breaking || BUMP_BY_TYPE[groups.type]));
}

/**
 * The changeset a derived release stands in for, written on the version branch.
 * Silent commits moved no version, so they stay out of the consumer changelog.
 */
export function derivedChangeset(bump, commits) {
  const entries = commits
    .filter((subject) => isReleasable(subject) || !CONVENTIONAL.test(subject))
    .map((subject) => `- ${subject}`)
    .join("\n");
  return `---\n"yayaw-table-workspace": ${bump}\n---\n\nReleases the distribution changes merged since the last tag.\n\n${entries || "Updates the registry implementation and installation inputs."}\n`;
}

const lines = (value) => (value ?? "").split("\n").filter(Boolean);

function main() {
  const root = resolve(process.argv[2] ?? ".");
  const version = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8")
  ).version;
  const tags = lines(process.env.RELEASE_TAGS);
  const plan = planRelease({
    pending: pendingChangesets(resolve(root, ".changeset")),
    version,
    tags,
    changedFiles: tags.includes(`v${version}`)
      ? changedReleaseInputs(`v${version}`, root)
      : [],
    commits: lines(process.env.RELEASE_COMMITS),
  });
  console.log(`${plan.action}: ${plan.reason}`);
  for (const subject of plan.unconventional) {
    console.log(
      `  no conventional bump; distribution changes still require a version: ${subject}`
    );
  }
  return plan;
}

if (process.argv[1]?.endsWith("release-plan.mjs")) {
  const plan = main();
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      output,
      [
        `action=${plan.action}`,
        `tag=${plan.tag ?? ""}`,
        `bump=${plan.bump ?? ""}`,
        `source=${plan.source ?? ""}`,
        `reason=${plan.reason}`,
        "",
      ].join("\n")
    );
  }
}
