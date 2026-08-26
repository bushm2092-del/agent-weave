# AgentWeave Development Rules

## Repository

- Use `pnpm` for dependency installation and scripts. Do not use npm or Yarn.
- Keep all applications and shared libraries under `packages/`; do not introduce an `apps/` directory.
- Prefer existing libraries, patterns, and package boundaries before adding new abstractions.
- Keep changes scoped to the requested feature and preserve unrelated worktree changes.

## Architecture

- Organize code by feature. Files that implement the same capability belong in the same feature directory.
- Put frontend/backend schemas and DTOs in `@agent-weave/contracts`; keep that package independent of React, Express, Node-only APIs, and agent runtime implementations.
- Keep Express routers focused on HTTP concerns: validation, service calls, status codes, and response serialization.
- Put business logic in services. Export service classes for tests and singleton instances for application use.
- Access external agents through gateway interfaces. Business services must not depend directly on `acpx` implementation details.
- Use the shared Result-style response envelope for HTTP success and error responses.

## TypeScript

- Keep strict TypeScript enabled and avoid `any`, unsafe type assertions, and duplicated request/response types.
- Validate all external input at runtime with shared Zod schemas.
- Use explicit error types and map internal errors at the HTTP boundary. Do not expose stack traces or sensitive details.
- Add an abstraction only when it removes meaningful duplication or isolates an external dependency.

## Frontend

- Use React Router for routing, Zustand with Immer for client state, Tailwind CSS for styling, and shadcn components where appropriate.
- Keep canvas behavior inside feature modules and keep tldraw-specific details out of general application state when possible.
- Preserve keyboard accessibility, focus behavior, loading states, empty states, and error states for interactive features.

## Formatting And Verification

- Format changed source and configuration files with Prettier. The repository print width is 120 characters.
- Run `pnpm exec prettier --write <changed-files>` after edits; do not format the entire dirty worktree unless explicitly requested.
- Run the narrowest relevant tests, lint, and typecheck first, then broaden verification when shared contracts or cross-package behavior changes.
- Do not commit generated build output, coverage files, runtime state, or secrets.

## Git

- Use Conventional Commits with concise Chinese subjects unless the user requests another language.
- Do not commit, amend, rebase, or push unless explicitly requested.
- Stage only files belonging to the current task. Never discard or overwrite unrelated user changes.
