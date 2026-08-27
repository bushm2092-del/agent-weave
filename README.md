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

The conversation API is asynchronous and streams persisted events over SSE:

```text
POST   /api/v1/conversations
GET    /api/v1/conversations/:conversationId
DELETE /api/v1/conversations/:conversationId
GET    /api/v1/conversations/:conversationId/events
GET    /api/v1/conversations/:conversationId/runs
POST   /api/v1/conversations/:conversationId/runs
POST   /api/v1/conversations/:conversationId/runs/:runId/cancel
POST   /api/v1/conversations/:conversationId/runs/:runId/permissions/:permissionId
PATCH  /api/v1/conversations/:conversationId/config-options/:configId
```

The read-only file API accepts absolute local paths:

```text
GET    /api/v1/files/list?path=/absolute/directory
GET    /api/v1/files/read?path=/absolute/file
GET    /api/v1/files/raw?path=/absolute/image
```

Directory reads return one level at a time, text reads accept UTF-8 files up to
2 MiB, and raw reads stream supported images up to 20 MiB.

ACP session configuration and permission options are forwarded dynamically; the
server does not maintain static model, reasoning, mode, or permission catalogs.
Copy `packages/server/.env.example` to `packages/server/.env` when overriding the
default host, port, CORS origins, SQLite path, acpx state directory, or turn timeout.

Run all checks from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm build
```
