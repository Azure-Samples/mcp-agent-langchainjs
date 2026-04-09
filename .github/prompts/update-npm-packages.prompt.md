## Context

This is an npm workspaces monorepo. The root `package.json` defines `"workspaces": ["packages/*"]`. The minimum supported Node.js version is declared in `engines.node` of the root `package.json`.

## Rules

- `@types/node` must NEVER be updated to a new major version unless the minimum Node.js version in `engines.node` changes. Minor and patch updates are fine.
- Do not update packages to versions that drop support for the project's minimum Node.js version.
- When a package has a major update, check its changelog or release notes for breaking changes before updating.
- If a major update introduces breaking changes that require code modifications, make those changes.
- If you're unsure whether a breaking change is safe, ask the user before proceeding.

## Task

1. Run `npm outdated` at the workspace root to get the full list of outdated packages across all workspaces.
2. Identify and categorize updates:
   - **Patch/minor updates**: safe to apply in batch.
   - **Major updates**: require individual review for breaking changes.
3. Apply all patch and minor updates first by running `npm update` at the workspace root.
4. Run `npm outdated` again to see remaining major updates.
5. For each major update (respecting the rules above):
   a. Check the package's changelog/release notes for breaking changes.
   b. If safe, update the version range in the relevant `package.json` file(s) and run `npm install`.
   c. If code changes are needed, apply them.
   d. If unsure, ask the user before proceeding.
6. After all updates, run `npm run build` to verify the project still compiles.
7. Run `npm run lint` to check for any new lint issues introduced by the updates.
8. Report a summary of all changes made.
