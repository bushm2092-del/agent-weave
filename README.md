# AgentWeave

AgentWeave is a pnpm monorepo for a spatial multi-agent workspace.

## Packages

- `packages/web`: React web application and canvas UI
- `packages/electron`: reserved for the Electron shell
- `packages/server`: reserved for the orchestration service

## Development

```bash
pnpm install
pnpm dev
```

Run all checks from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm build
```
