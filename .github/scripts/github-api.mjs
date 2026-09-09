import { setTimeout as sleep } from "node:timers/promises";

/** Bounded, read-only GitHub requests used without application dependencies. */
export class GitHubApi {
  constructor(token, transport = fetch, delay = sleep) {
    if (!token) {
      throw new Error("GITHUB_TOKEN is required.");
    }
    this.token = token;
    this.transport = transport;
    this.delay = delay;
  }

  async get(path) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response;
      try {
        response = await this.transport(`https://api.github.com/${path}`, {
          signal: AbortSignal.timeout(30_000),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
      } catch (error) {
        if (attempt === 3) {
          throw new Error(`GitHub GET ${path} failed after three attempts.`, {
            cause: error,
          });
        }
        await this.delay(attempt * 2000);
        continue;
      }
      if (response.ok) {
        return response.json();
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await response.body?.cancel();
        await this.delay(attempt * 2000);
        continue;
      }
      throw new Error(
        `GitHub GET ${path} returned HTTP ${response.status}.` +
          (response.status === 403
            ? " Check actions:read, contents:read and pull-requests:read permissions; this refusal is not retried."
            : "")
      );
    }
    throw new Error("GitHub retry budget exhausted.");
  }
}
