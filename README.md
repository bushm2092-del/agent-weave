# AgentWeave

[English](README.md) | [简体中文](README.zh-CN.md)

AgentWeave is a local-first, spatial workspace for running individual AI agents and coordinating multi-agent teams. It combines a visual canvas, durable conversations, role presets, team orchestration, and an Electron desktop shell in one pnpm monorepo.

> AgentWeave is currently under active development. APIs and persisted data formats may change before the first stable release.

## Product Preview

### Spatial multi-agent canvas

Place agents from different providers on one infinite canvas, keep each conversation independent, and arrange the workspace around the task.

![Multiple AI agents arranged on the AgentWeave canvas](./img/multi-agent-canvas.png)

### Live agent conversations

Work with an agent directly inside a resizable canvas node, including model controls, streamed responses, reasoning, tool calls, and workspace context.

![A live Pi agent conversation with tool-call output](./img/agent-conversation.png)

### Agent Team orchestration

Coordinate a leader and multiple teammates in one team node, while inspecting members, tasks, and activity from the team panel.

![An Agent Team with four independently managed members](./img/agent-team.png)

### Reusable role presets

Create persisted roles with provider-specific instructions, then assign them consistently when building new agent teams.

![The AgentWeave role preset library](./img/role-presets.png)

## Highlights

- **Spatial canvas**: arrange agents, teams, files, and working context on a persistent tldraw canvas.
- **Live agent conversations**: stream assistant output, reasoning, tools, permissions, and usage updates over SSE.
- **Durable sessions**: persist conversations, completed content blocks, runs, canvas snapshots, and team state in SQLite.
- **Shared memory foundation**: capture reusable knowledge from completed Agent work, then recall it across sessions and Agents so teams can build on prior decisions, discoveries, and working patterns.
- **Agent Teams**: create a leader and teammates with isolated conversations, shared workspace context, tasks, mailbox messages, and approval-controlled spawning.
- **Role presets**: define reusable roles with provider selection and system prompts, then assign them to team leaders or members.
- **Local file access**: browse and preview supported files from an agent workspace through a constrained read-only API.
- **Desktop distribution**: package the web UI and embedded API as macOS or Windows applications.

## Architecture

| Package | Responsibility |
| --- | --- |
| `packages/web` | React 19 application, tldraw canvas, conversation UI, and team management |
| `packages/server` | Express API, SQLite persistence, SSE streams, acpx integration, and team orchestration |
| `packages/contracts` | Shared Zod schemas, request/response DTOs, events, and domain types |
| `packages/desktop` | Electron shell and macOS/Windows packaging |

The server communicates with agent runtimes through `acpx`. Team agents also collaborate through an authenticated stdio MCP bridge. Each team member owns an isolated managed conversation while the Team service coordinates runs, tasks, mailbox intents, spawn approvals, and replayable events.

## Requirements

- Node.js 24 or later
- pnpm 11 (the repository pins the expected version through `packageManager`)
- An agent provider supported by the local `acpx` installation

## Quick Start

Install dependencies and start the web application and API:

```bash
pnpm install
pnpm dev
```

The web application is available at `http://localhost:5173` by default.

To start only one side:

```bash
pnpm dev:web
pnpm dev:server
```

To run the Electron application, including its development web and API servers:

```bash
pnpm dev:desktop
```

## Configuration

Copy the server environment example before overriding defaults:

```bash
cp packages/server/.env.example packages/server/.env
```

The server configuration covers the host, port, allowed CORS origins, SQLite database path, acpx state directory, and turn timeout. Desktop production builds use the platform user-data directory by default. Set `AGENT_WEAVE_API_ORIGIN` before launching the desktop application to connect it to an external API server.

## Desktop Builds

Create unpacked application output:

```bash
pnpm desktop:pack
```

Build distributable packages under `packages/desktop/release`:

```bash
pnpm desktop:dist:mac
pnpm desktop:dist:win
```

The macOS build produces DMG and ZIP artifacts for Intel and Apple Silicon. The Windows build produces an x64 NSIS installer and portable executable.

## Main APIs

The API is mounted under `/api/v1` and includes:

- `/canvases`: canvas metadata and persistent snapshots
- `/conversations`: conversations, runs, permissions, configuration, and SSE events
- `/teams`: members, messages, runs, tasks, approvals, and team event streams
- `/role-presets`: reusable agent roles and system prompts
- `/files`: constrained read-only directory, text, and image access

Conversation and Team event streams support sequence cursors for reconnecting clients. Live content deltas are delivered as transient SSE events, while completed run content is stored as full blocks for efficient reloads.

## Roadmap

- **Stabilize the Web experience**: harden canvas persistence, Agent and Team lifecycle recovery, streaming reconnection, error handling, compatibility, and end-to-end test coverage.
- **Reach Desktop feature parity**: keep macOS and Windows behavior aligned with the Web application, improve embedded-service reliability, environment detection, data migration, signing, packaging, and automatic updates.
- **Real-time artifact updates**: stream Agent-created files and deliverables into the workspace, refresh previews as content changes, preserve artifact versions, and surface build and export status without manual reloads.
- **Multi-Agent memory reuse**: introduce layered personal, project, and Team memory so one Agent's useful discoveries can be recalled by other Agents without repeating the same research or setup.
- **Internationalization**: keep English and Simplified Chinese aligned, follow the system language by default while retaining explicit user overrides, and extend coverage as new surfaces are added.
- **Skills**: add reusable Skill discovery, installation, configuration, permission controls, and assignment to individual Agents, role presets, and Agent Teams.
- **Office workflows**: support creating, reading, editing, previewing, and exporting Word documents, spreadsheets, presentations, and PDFs through Agent-assisted workflows.

## Quality Checks

Run all repository checks from the project root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Documentation

- [`docs/agent-team-product-interaction.md`](docs/agent-team-product-interaction.md): Agent Team product flows
- [`docs/agent-team-code-architecture.md`](docs/agent-team-code-architecture.md): Agent Team implementation boundaries

## Community

Scan the QR code to join the AgentWeave WeChat group for product updates, usage discussions, and feedback. The invitation QR code is refreshed periodically.

<img src="./img/agent-weave-wechat-group.jpg" alt="Join the AgentWeave WeChat group" width="360" />

## License

No license has been declared yet. Until one is added, all rights are reserved by the repository owner.
