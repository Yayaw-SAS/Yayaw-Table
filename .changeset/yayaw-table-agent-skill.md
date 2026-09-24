---
"yayaw-table-workspace": patch
---

Add an agent skill so coding agents (Claude Code, Codex) integrate YaYaw Table correctly. `skills/yayaw-table/SKILL.md` gives the decision guide (install, minimal React and Vue setup, `TableConfig`, display modes, server contracts, scopes, forms, connectors, parity) and routes to the installed types; `references/` covers install and pinned versions with SHA-256 verification, configuration, display modes and dashboards, every action contract with its fallback, forms and public form security, connectors and the sync engine, testing, and pitfalls. The README explains how to copy it into `.claude/skills/`, `~/.claude/skills/` or `.codex/skills/`.

`bun run skill:check`, now part of `bun run check`, validates the skill against the code: frontmatter, relative and repository links, and tables that must list exactly the display modes, column types, filter operators, list scope kinds, registry items and action and connector contract members the code declares, plus the `actions.*` names, helpers, paths and imports it mentions. The table itself is unchanged.
