# AgentWeave

AgentWeave is a pnpm monorepo for a spatial multi-agent workspace.

## Packages

- `packages/web`: React web application and canvas UI
- `packages/contracts`: shared Zod schemas, request/response DTOs, and Result envelopes
- `packages/electron`: reserved for the Electron shell
- `packages/server`: Express API and the embedded acpx agent communication layer

## Development

```bash
pnpm install
pnpm dev
```

Start the API separately:

```bash
pnpm dev:server
```

The first conversation endpoint is `POST /api/v1/conversations`. Copy
`packages/server/.env.example` to `packages/server/.env` when overriding the
default host, port, CORS origins, acpx state directory, or turn timeout.

Run all checks from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm build
```
