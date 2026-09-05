# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`
- **Sync registry** (after editing `src/components/ui/yayaw-table`): `bun run registry:sync`
- **Build latest registry**: `bun run registry:build`
- **Build release registry snapshot**: `bun run registry:release`
- **Add release note / version intent**: `bun run changeset`

## React/Vue Parity (Release Gate)

YaYaw Table's React and Vue editions are one product. Every consumer-facing feature or change must ship with equivalent behavior in both frameworks in the same task. A change is incomplete while either edition has a known functional gap.

- Keep public configuration names, defaults, aliases, serialized state, actions, permissions, validation, errors, retries, accessibility outcomes, and user-visible behavior aligned.
- Cover table, gallery, Kanban, toolbar, saved views, filters, sorting, selection, export, inline editing, catalogue forms, and `tablePicker` behavior whenever the affected feature crosses those surfaces.
- Framework-specific implementation details may differ, but observable outcomes and serializable public contracts must match. Document any unavoidable framework-native limitation explicitly instead of silently accepting a gap.
- Add equivalent React and Vue regression coverage for every behavior change. Update shared parity fixtures when the contract is data-driven.
- Keep the runnable Vue example in `packages/yayaw-table-vue/demo/App.vue` representative of the React example. Exercise user-facing changes in both examples with a real browser when interaction or layout is involved.
- Update `docs/FRAMEWORK-PARITY.md` with every parity-affecting change, including new defaults, aliases, limitations, and verification coverage.
- Run the relevant React and Vue tests, type checks, builds, and registry generation before opening the PR. For a full parity release gate, run `bun run release:check` and `bun run release:verify`.

Do not merge a consumer-facing change with a temporary one-framework implementation. Split shared contracts into framework-neutral helpers where that reduces drift, while keeping each registry independently installable.

## Yayaw Documentation and Protected Seed

Public YaYaw Table documentation is maintained in the separate [Yayaw repository](https://github.com/Yayaw-SAS/Yayaw) and published from its database-backed documentation system. Any change to the public API, behavior, defaults, setup, examples, or migration path requires a companion documentation change in that repository.

1. Start from the latest `main` in `Yayaw-SAS/Yayaw`, create a fresh `codex/` branch, and open a companion PR. Link the Table and Yayaw PRs to each other.
2. Update the English and French snapshots under `content/docs/en/table` and `content/docs/fr/table` as one atomic documentation change.
3. Add the exact reviewed source-hash transition to `src/lib/scripts/documentation/seed-updates.ts` and update its tests. Follow the existing protected migration pattern so known prior revisions can reach the new bilingual snapshot.
4. Preserve CMS-authored or otherwise unknown revisions as conflicts. Never broaden a seed transition or overwrite protected database content merely to make a deployment pass.
5. Regenerate and verify documentation artifacts with `bun run docs:generate`, `bun run docs:check-links`, `bun run docs:check-translations`, and `bun run docs:llm:check`, plus the repository's standard check, type-check, test, and build gates.
6. Merge the companion Yayaw PR and verify the deployment seed reports `readyForCutover: true` and publishes the intended pages before considering the Table documentation complete.

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

### Registry (yayaw-table)

The **source of truth** for the Shadcn registry is `src/components/ui/yayaw-table` (and listed files in `src/components/ui/custom`) in this repository. The folder `registry/default/ui/yayaw-table` is **generated** by `scripts/build-registry.mjs`. Only edit files under `src/`. After changes to yayaw-table or custom UI files, run `bun run registry:sync` to regenerate the registry and `registry.json`.

Note: in consumer projects, the registry now installs files under `components/ui/yayaw-table` (target path), not under `src/components/ui/yayaw-table`.

### Versioning and Releases (LLM Instructions)

YaYaw Table is versioned as a **Shadcn registry distribution**, not as a published npm package. The SemVer source of truth is `package.json.version`; release notes are tracked with Changesets and `CHANGELOG.md`; immutable registry snapshots live under `public/r/vX.Y.Z/`.

Use this flow for consumer-facing changes:

1. If the change affects the copied table API, behavior, setup requirements, dependencies, or migration path, run `bun run changeset` and choose the appropriate SemVer bump.
2. Use `patch` for fixes with no consumer migration, `minor` for backward-compatible features, and `major` for renamed/removed APIs or required consumer migrations. While the project is still `0.x`, breaking consumer changes should usually be a `minor` bump with a clear breaking note.
3. For normal feature/fix PRs, run `bun run registry:sync` after editing `src/components/ui/yayaw-table` or `src/components/ui/custom`.
4. For an actual release commit, run `bun run version`; it applies Changesets, updates `CHANGELOG.md`, runs `bun run registry:release`, and creates `public/r/vX.Y.Z/yayaw-table.json`.
5. Before tagging, run `bun run release:check` and `bun run release:verify`.
6. Tag releases as `vX.Y.Z`, matching `package.json.version`. The GitHub release body is generated automatically from merged PRs and commits; do not hand-write release notes in the workflow unless the automation is intentionally changing.

Never edit `public/r/vX.Y.Z/` snapshots by hand to change an already published version. Bump the version and create a new snapshot instead. Only use `ALLOW_VERSION_SNAPSHOT_OVERWRITE=1 bun run registry:snapshot` for an intentional repair of an unpublished or broken snapshot.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Prefer accessible image markup and require meaningful alternative text.

### Framework-Specific Guidance

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.
