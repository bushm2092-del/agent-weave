# AgentWeave Agent Team 代码架构方案

> 实现状态（2026-08-27）：本文的核心架构已经落地，包括 Team/Member 持久化、Team-owned Conversation、Mailbox/Work Intent、Team Run、Task Board、MCP、可回放 SSE、Crash Recovery、Canvas 投影和动态扩编审批。文中标记为“后续”的成员暂停、Session 手动启停、成本聚合和多宿主进程部署不属于本次交付。

## 1. 架构结论

建议在 AgentWeave 中新增独立的 `teams` 领域，但继续把单个 Agent 的 Session、Run、流式事件和权限处理交给现有 `conversations` 领域。

核心边界如下：

```text
Web Canvas
  ├─ Team projection / Team Inspector / Team SSE
  └─ Existing ConversationWindow / Conversation SSE
                         │
                         ▼
Express composition root
  ├─ ConversationService ── AgentGateway ── acpx/runtime
  └─ TeamService
       ├─ TeamSessionRegistry
       │    └─ TeamSession (one per active team)
       │         ├─ WorkCoordinator
       │         ├─ MemberEventLoops
       │         ├─ Mailbox
       │         ├─ TaskBoard
       │         └─ TeamMcpServer
       ├─ ConversationProvisioningPort ──────┐
       └─ ConversationTurnPort ──────────────┴─> ConversationService
```

不能把 Team 调度直接写进 `ConversationService`，也不能让 Team 自己绕开 ConversationService 直接调用 `AgentGateway`。前者会让单 Agent 主路径变复杂，后者会重复实现 Run 持久化、SSE、权限、取消和恢复。

## 2. 分析依据

### 2.1 pandora-core 的实际实现

参考实现的关键调用链位于：

| 能力                  | 位置                                                             |
| --------------------- | ---------------------------------------------------------------- |
| HTTP 路由             | `crates/aionui-team/src/routes.rs`                               |
| Team 领域编排         | `crates/aionui-team/src/service.rs`                              |
| 每 Team 运行上下文    | `crates/aionui-team/src/session.rs`                              |
| 每成员事件循环        | `crates/aionui-team/src/event_loop.rs`                           |
| Slot 工作协调         | `crates/aionui-team/src/work_coordinator/`                       |
| Team Run 因果状态     | `crates/aionui-team/src/team_run/`                               |
| 成员状态与调度动作    | `crates/aionui-team/src/scheduler/`                              |
| 持久化消息            | `crates/aionui-team/src/mailbox.rs`                              |
| 共享任务              | `crates/aionui-team/src/task_board.rs`                           |
| MCP Server/Bridge     | `crates/aionui-team/src/mcp/`                                    |
| 角色和 Wake Prompt    | `crates/aionui-team/src/prompts/`、`crates/aionui-team-prompts/` |
| Conversation 适配端口 | `crates/aionui-team/src/ports.rs`                                |
| 依赖组装              | `crates/aionui-app/src/router/state.rs`                          |

当前参考代码的执行模型不是简单的 `Idle -> Working -> Idle`，而是：

1. 用户或 Agent 产生一个 Work Intent。
2. WorkCoordinator 给 Intent 绑定优先级、目标 Slot 和 `teamRunId`。
3. 消息先写入 Mailbox，再提交 Enqueue Lease。
4. Slot Event Loop 被通知，peek 未读消息并 Claim 一个 Work Batch。
5. TeamSession 生成 Role/Wake Prompt。
6. Conversation Adapter 启动真实 Agent Turn。
7. 开始、结束、取消映射为 Child Turn 和 Team Run 事件。
8. 成功或终止后再把 Mailbox 消息标记完成，继续 Drain。

### 2.2 参考实现值得复用的设计

- Team 和 Conversation 是两个领域，通过 Port 连接。
- Team Session 是内存运行时，Team/Mailbox/Task 是持久化事实。
- 用户消息和 Agent 间消息都先形成可恢复 Work Intent。
- Agent 间消息不是普通前端请求，而是受身份和角色约束的 MCP Tool Call。
- 每个成员只有一个活动 Turn，后续消息可靠排队。
- Team Run 追踪因果工作，Agent-to-Agent 派单继承当前 Run。
- Role Prompt、Tool Schema 和 Tool Authorization 是同一个治理契约。
- Runtime Ready 与 Work Running 分离，避免把启动失败误判为任务失败。

### 2.3 不应照搬的部分

| 参考实现问题                                     | AgentWeave 的选择                                         |
| ------------------------------------------------ | --------------------------------------------------------- |
| 仓库旧文档与当前代码多处不一致                   | 以 contracts + tests + 当前代码为单一事实来源             |
| Team 成员整体序列化在 `teams.agents` JSON        | 使用规范化 `team_members` 表和外键                        |
| `TeamSessionService`、`TeamSession` 已很大       | 按 Provisioning、Runtime、Coordination、Projection 拆模块 |
| 自定义 TCP/HTTP JSON-RPC 实现较重                | 使用标准 MCP SDK，保留通用 stdio bridge 边界              |
| Team 状态走 WebSocket，Conversation 走另一套事件 | AgentWeave 统一使用可回放 SSE                             |
| Team Run 的大量协调状态主要在内存                | 关键 Intent/Run 状态持久化，重启可明确恢复                |
| Task 依赖缺少环检测                              | 写入依赖时进行有向图环检测                                |

## 3. AgentWeave 当前基础

### 3.1 可直接复用

- `ConversationService` 已实现 Conversation 创建、串行 Run 队列、取消和恢复。
- `ConversationEventBus` 会先持久化 Event，再通知 SSE Listener。
- `AcpxAgentGateway` 已封装 acpx Session、流式事件、权限请求和取消。
- `SqliteConversationRepository` 已有 SQLite WAL、外键和测试内存库。
- Web 端已有 Conversation API、SSE Controller、Zustand Store 和完整 Conversation Window。
- tldraw 已支持 Team Frame 接收 Agent 子 shape。

### 3.2 必须先修的架构缺口

1. `SqliteConversationRepository` 自己创建数据库连接并在 Repository 内执行 migration；新增 Team 后需要共享数据库连接和统一 Migration Runner。
2. `ConversationService.create()` 只能创建 Solo Conversation，没有 owner/runtime context。
3. `AgentSessionInput` 只有 `sessionKey/agent/workspace`，无法注入 Team Role Prompt 或 MCP Server。
4. `AcpxAgentGateway` 只有一个全局 `AcpRuntime`；acpx 的 `mcpServers` 是 Runtime 配置，不是当前 API 中的 per-session 参数。
5. `ConversationService.createRun()` 只返回已排队 Run，Team 调度器没有等待 Turn 终态的内部端口。
6. 事件只有 Conversation 维度，没有 Team 快照和 Team SSE。
7. 删除任何 Agent shape 都会删除 Conversation，无法区分 Solo 与 Team-owned Conversation。
8. tldraw localStorage 是唯一 Canvas 持久化，后端没有 `canvasId -> teamId` 关联。

## 4. 推荐模块结构

```text
packages/contracts/src/teams/
├── team.types.ts
├── team.contracts.ts
├── team-event.types.ts
├── team-run.types.ts
└── index.ts

packages/server/src/database/
├── database.ts
├── migration-runner.ts
└── migrations/
    ├── 001_conversations.sql
    └── 002_teams.sql

packages/server/src/features/teams/
├── team.models.ts
├── team.errors.ts
├── team.router.ts
├── team.service.ts
├── team-event-bus.ts
├── index.ts
├── persistence/
│   ├── team.repository.ts
│   └── sqlite-team.repository.ts
├── provisioning/
│   ├── team-provisioner.ts
│   └── conversation-team.adapter.ts
├── runtime/
│   ├── team-session.ts
│   ├── team-session-registry.ts
│   ├── member-runtime-registry.ts
│   └── member-event-loop.ts
├── coordination/
│   ├── work-coordinator.ts
│   ├── team-run-manager.ts
│   ├── mailbox.ts
│   └── task-board.ts
├── mcp/
│   ├── team-mcp-server.ts
│   ├── tool-registry.ts
│   ├── tool-authorization.ts
│   └── stdio-bridge.ts
└── prompts/
    ├── leader-prompt.ts
    ├── teammate-prompt.ts
    └── wake-prompt.ts

packages/web/src/features/teams/
├── api/team-api.ts
├── api/team-event-stream.ts
├── lifecycle/team-controller.ts
├── store/team-store.ts
├── store/apply-team-event.ts
├── canvas/team-shape-binding.ts
├── components/create-team-dialog.tsx
├── components/team-header.tsx
├── components/team-inspector.tsx
├── components/member-list.tsx
├── components/task-list.tsx
└── components/activity-list.tsx
```

`team.service.ts` 只负责编排公开用例，不持有具体 Event Loop 算法；`team-session.ts` 组合运行时组件，但各组件保持独立测试。

## 5. 领域模型

### 5.1 Team 与 Member

```ts
type Team = {
  id: string
  canvasId: string
  name: string
  workspace: string
  leaderSlotId: string
  sessionStatus: "starting" | "ready" | "failed" | "stopped"
  sessionError?: string
  createdAt: string
  updatedAt: string
}

type TeamMember = {
  slotId: string
  teamId: string
  conversationId: string
  name: string
  role: "leader" | "teammate"
  provider: AgentProvider
  model?: string
  runtimeStatus: "pending" | "ready" | "failed" | "removing"
  runtimeError?: string
  createdAt: string
  updatedAt: string
}
```

约束：

- 每个 Team 恰好一个 Leader。
- `conversationId` 全局唯一归属一个 Member。
- 同 Team 的规范化成员名唯一。
- Leader 不允许单独删除。
- Team Member 的 Workspace 必须等于 Team Workspace。

### 5.2 Team Run

```ts
type TeamRunStatus = "accepted" | "running" | "cancelling" | "completed" | "cancelled" | "failed"

type TeamRun = {
  id: string
  teamId: string
  source: "user_message"
  targetSlotId: string
  status: TeamRunStatus
  hasUserIntervention: boolean
  createdAt: string
  startedAt?: string
  completedAt?: string
}
```

Team Run 是用户可见的顶层因果单位，不等于 Conversation Run：

- 一个 Team Run 可以包含多个成员的多个 Conversation Run。
- 每个实际 Agent Turn 仍然落入现有 `runs` 表。
- `team_work_intents.conversation_run_id` 负责二者关联；Child Turn 是这条关联的事件投影。

### 5.3 Work Intent 与 Slot 状态

```ts
type WorkIntent = {
  id: string
  teamId: string
  teamRunId?: string
  slotId: string
  mailboxMessageId?: string
  source: "user_message" | "user_intervention" | "mcp_message" | "membership_changed" | "shutdown_request" | "recovery"
  priority: "foreground" | "control" | "background"
  state: "queued" | "starting" | "running" | "completed" | "failed" | "cancelled"
  conversationRunId?: string
  createdAt: string
  updatedAt: string
}
```

Slot 的展示状态由 Intent 和 Runtime 约束推导，不单独作为唯一事实存储：

```text
runtime failed/removing/stopped -> blocked
active conversation run       -> running
claimed batch                 -> starting
queued intent                 -> queued
paused flag                   -> paused
otherwise                     -> idle
```

## 6. 数据库设计

### 6.1 共享数据库基础设施

先把 SQLite 从 Conversation Repository 中提升为应用级依赖：

```ts
type AppDatabase = {
  connection: DatabaseSync
  transaction<T>(work: () => T): T
}
```

所有 Repository 接收同一 `DatabaseSync`。Migration 由 `packages/server/src/database/migration-runner.ts` 在应用启动时统一执行，不能让每个 Repository 自己猜测 Schema 状态。

### 6.2 建议表

```sql
teams(
  id primary key,
  canvas_id not null,
  name not null,
  workspace not null,
  leader_slot_id not null,
  session_status not null,
  session_error,
  created_at not null,
  updated_at not null
)

team_members(
  slot_id primary key,
  team_id references teams on delete cascade,
  conversation_id unique references conversations on delete cascade,
  name not null,
  normalized_name not null,
  role not null,
  provider not null,
  model,
  runtime_status not null,
  runtime_error,
  created_at not null,
  updated_at not null,
  unique(team_id, normalized_name)
)

team_mailbox(
  id primary key,
  team_id references teams on delete cascade,
  team_run_id references team_runs,
  to_slot_id not null,
  from_actor_id not null,
  type not null,
  content not null,
  attachments_json not null,
  dedupe_key unique,
  state not null,
  created_at not null,
  consumed_at
)

team_tasks(
  id primary key,
  team_id references teams on delete cascade,
  subject not null,
  description,
  status not null,
  owner_slot_id,
  created_at not null,
  updated_at not null
)

team_task_dependencies(
  task_id references team_tasks on delete cascade,
  blocked_by_task_id references team_tasks on delete cascade,
  primary key(task_id, blocked_by_task_id)
)

team_runs(
  id primary key,
  team_id references teams on delete cascade,
  source not null,
  target_slot_id not null,
  status not null,
  has_user_intervention not null,
  created_at not null,
  started_at,
  completed_at,
  error
)

team_work_intents(
  id primary key,
  team_id references teams on delete cascade,
  team_run_id references team_runs,
  slot_id references team_members,
  mailbox_message_id references team_mailbox,
  source not null,
  priority not null,
  state not null,
  conversation_run_id references runs,
  created_at not null,
  updated_at not null
)

team_events(
  sequence integer primary key autoincrement,
  id unique not null,
  team_id references teams on delete cascade,
  type not null,
  data not null,
  created_at not null
)
```

### 6.3 Conversation 表扩展

新增：

```sql
alter table conversations add column owner_kind text not null default 'solo';
alter table conversations add column owner_id text;
```

- Solo：`owner_kind=solo, owner_id=null`。
- Team Member：`owner_kind=team_member, owner_id=slotId`。

Team MCP Token、临时端口不写入数据库。重启后由 TeamSession 重新生成，再由 Gateway 建立新的 Runtime 配置。

## 7. Conversation 领域改造

### 7.1 新增内部 Provisioning Port

公开的 `CreateConversationRequest` 保持不变；Team 使用独立内部接口：

```ts
interface ConversationProvisioningPort {
  createTeamConversation(input: {
    id: string
    ownerSlotId: string
    provider: AgentProvider
    workspace: string
  }): Conversation
  initializeTeamConversation(conversationId: string, context: TeamAgentSessionContext): Promise<void>
  deleteTeamConversation(conversationId: string): Promise<void>
}
```

Team 创建事务内只插入 Conversation 记录，不启动 Agent。事务提交后再创建 TeamSession 和初始化 Runtime。这样 Runtime 启动失败不会回滚已经提交的业务事实，而是进入可重试 `failed` 状态。

### 7.2 新增 Turn Port

```ts
interface ConversationTurnPort {
  enqueueTeamTurn(input: {
    conversationId: string
    teamId: string
    teamRunId?: string
    slotId: string
    message: string
    attachments: MessageAttachment[]
    onStarted(run: Run): void | Promise<void>
  }): Promise<{ run: Run; completion: Promise<Run> }>

  cancelTeamTurn(conversationId: string, runId: string): Promise<Run>
}
```

实现仍调用 Conversation Repository、Event Bus 和 Agent Gateway。Team Event Loop 只等待 `completion` 并更新 Work Intent，不处理 Token Delta。

### 7.3 启动恢复顺序

当前入口直接执行 `conversationService.restoreAll()`。改为：

```text
1. database.migrate()
2. teamService.restoreAllSessions()
   - 重建 TeamSession/MCP
   - 恢复 Team-owned Conversation
   - running intent -> queued/recovery
3. conversationService.restoreSoloConversations()
4. app.listen()
```

Team-owned Conversation 不能被 `restoreSoloConversations()` 再次初始化。

## 8. acpx 与 MCP 集成

### 8.1 当前约束

本项目安装的 acpx runtime 已支持：

- Runtime 级 `mcpServers`。
- `ensureSession.sessionOptions` 中的 `model/systemPrompt/env`。
- system prompt 只在 fresh session 创建时生效；复用已有 persistent session 时忽略变化。

因此不能把已有 Solo Conversation 静默升级成 Team Member。

### 8.2 Gateway 改造

把当前单一 `runtime` 改为按 Session 管理的 Runtime Entry：

```ts
type RuntimeEntry = {
  runtime: AcpRuntime
  handle?: AcpRuntimeHandle
  fingerprint: string
}

interface AcpRuntimeFactory {
  create(input: { mcpServers?: McpServer[] }): AcpRuntime
}
```

`AcpxAgentGateway.initializeSession()` 接收：

```ts
type TeamAgentSessionContext = {
  rolePrompt: string
  model?: string
  mcp: {
    command: string
    args: string[]
    env: Record<string, string>
  }
}
```

每个 Team Member 使用独立 Runtime Entry，明确注入该成员的 `port/token/slotId`，不依赖父进程环境变量碰巧被 MCP 子进程继承。Solo Conversation 仍使用无 MCP 的默认配置。

`fingerprint` 由 Provider、Workspace、MCP Server 配置和稳定 Session Options 计算。配置变化时关闭旧 Entry，再创建新 Entry。

### 8.3 Team MCP 传输

沿用参考实现的边界，但在 TypeScript 中使用标准 MCP SDK：

```text
ACP Agent
  └─ starts stdio MCP bridge
       └─ authenticated loopback request
            └─ TeamMcpServer
                 └─ TeamSession / ToolRegistry
```

每个 TeamSession 生成：

- 随机 loopback 端口或内部 loopback URL。
- 高熵 Session Token。
- 每成员 `slotId`。

stdio bridge 只做协议转发，不含业务逻辑。ToolRegistry 才负责 Schema、权限、调用和错误映射。

### 8.4 MCP 工具

MVP 工具：

| 工具                | 权限     | 作用                  |
| ------------------- | -------- | --------------------- |
| `team_send_message` | 所有成员 | 单播/广播，并唤醒目标 |
| `team_task_create`  | 所有成员 | 创建共享任务          |
| `team_task_update`  | 所有成员 | 状态、Owner、依赖     |
| `team_task_list`    | 所有成员 | 查询任务              |
| `team_members`      | 所有成员 | 查询真实阵容和状态    |
| `team_rename_agent` | Leader   | 重命名成员            |

下一阶段：

- `team_list_runners`
- `team_spawn_agent`
- `team_shutdown_agent`

Tool 描述、输入 Schema、可见性和服务端授权必须来自同一份 Tool Definition，不能分别硬编码。

## 9. Prompt 架构

### 9.1 稳定 Role Prompt

Role Prompt 只包含稳定治理规则：

- 当前 `teamId/slotId/role`。
- 必须使用 `team_*` 工具协作。
- Leader 只协调、拆解、汇总。
- Teammate 接任务、更新任务、汇报并结束回合。
- Standing by 表示结束当前 Turn，不持续生成等待文本。
- 依赖工作按完成顺序派发，不让下游 Agent 占着 Turn 等待。

动态成员列表和任务不写进 immutable system prompt，统一通过 `team_members`、`team_task_list` 和 Wake Prompt 获取。

### 9.2 Wake Prompt

每次 Event Loop Claim Batch 时生成：

```text
Role identity
New mailbox messages
Relevant task summary
Current run/slot context
Execution instruction
```

Mailbox 内容属于业务输入，不能拼接成伪 system 指令。所有来源必须带 `fromActorId/type`，并对长度、附件和控制字符做限制。

## 10. Team 调度

### 10.1 入队事务

所有来源统一走：

```text
validate target/runtime
  -> acquire enqueue lease
  -> persist mailbox message (when present)
  -> persist work intent
  -> bind/create team run
  -> commit
  -> publish event
  -> notify member event loop
```

如果持久化成功、notify 失败，请求仍返回 `queued`，不能返回可重试的发送失败。Event Loop 恢复扫描会继续处理。

### 10.2 每成员 Event Loop

每个 Slot 一个逻辑 Event Loop，同一 Slot 至多一个活动 Conversation Run：

```text
notify
  -> load queued intents by priority
  -> verify runtime constraint
  -> claim batch atomically
  -> build wake prompt
  -> ConversationTurnPort.enqueueTeamTurn
  -> mark child turn started
  -> await completion
  -> complete/fail batch
  -> consume mailbox messages
  -> continue drain
```

ConversationService 已有每 Conversation 串行队列，Team Coordinator 仍然必要，因为它还承担 Team Run 因果、优先级、Mailbox 恢复、Slot 状态和跨成员取消。

### 10.3 Team Run 完成条件

一个 Run 在以下条件全部满足时完成：

- 没有该 Run 的 Enqueue Lease。
- 没有该 Run 的 queued/starting/running Intent。
- 没有该 Run 的活动 Child Turn。

存在 failed Intent 时 Run 为 `failed`；用户开始取消后最终为 `cancelled`；否则为 `completed`。

### 10.4 幂等与并发

- 用户消息要求 `clientMessageId`，数据库唯一。
- MCP Tool Call 使用 `requestId + callerSlotId` 去重。
- 动态增删成员使用每 Team Membership Mutex/Lease。
- Event 使用全局递增 sequence，客户端按 sequence 去重。
- Member Event Loop 的 Claim 用事务状态迁移保证单 Owner。
- 完成/取消使用 compare-and-set，迟到的完成事件不能覆盖 Cancelled。

## 11. API 契约

### 11.1 REST

```text
POST   /api/v1/teams
GET    /api/v1/teams?canvasId=
GET    /api/v1/teams/:teamId
PATCH  /api/v1/teams/:teamId
DELETE /api/v1/teams/:teamId

POST   /api/v1/teams/:teamId/members
DELETE /api/v1/teams/:teamId/members/:slotId

POST   /api/v1/teams/:teamId/messages
POST   /api/v1/teams/:teamId/members/:slotId/messages
GET    /api/v1/teams/:teamId/runs
POST   /api/v1/teams/:teamId/runs/:teamRunId/cancel

POST   /api/v1/teams/:teamId/spawn-requests/:requestId/approve
POST   /api/v1/teams/:teamId/spawn-requests/:requestId/reject
GET    /api/v1/teams/:teamId/events?after=

POST   /api/v1/internal/team-tools/:toolName
```

Team 快照本身包含 `members`、`tasks`、`spawnRequests` 和 `activeRun`，因此首版不再增加重复的 run-state/tasks 查询端点。成员级暂停、Session 手动启停和用户编辑 Task 是后续扩展。

除 `POST /teams` 和只读查询/SSE 外，宿主侧 Team 变更请求必须携带创建时返回的 `x-agent-weave-team-control` capability。服务端只保存 capability 的 SHA-256 哈希；Web 按 `teamId` 存在浏览器本地存储中。该 capability 不注入成员 Runtime，成员只得到自己的内部 MCP Bearer Token。迁移前创建、没有哈希的旧 Team 暂时走兼容路径。

### 11.2 创建请求

```ts
type CreateTeamRequest = {
  canvasId: string
  name: string
  workspace: string
  leader: {
    name: string
    agent: AgentProvider
    model?: string
  }
  members: Array<{
    name: string
    agent: AgentProvider
    model?: string
  }>
}
```

必须由 Zod 验证：Leader 必填、最多七个初始 Teammate、名字唯一、Workspace 合法、Provider 在服务端允许列表中。Leader 由独立字段表达，避免客户端提交多个 Leader。

### 11.3 SSE Event

```ts
type TeamEvent = {
  sequence: number
  id: string
  teamId: string
  teamRunId?: string
  slotId?: string
  type: TeamEventType
  data: unknown
  createdAt: string
}
```

Team Event 只传状态和结构变化，Conversation Token Delta 继续走 Conversation Event。

## 12. Web 与 Canvas 集成

### 12.1 Shape Props

```ts
type AgentTeamShapeProps = {
  w: number
  h: number
  teamId: string
  name: string
}

type AgentShapeTeamBinding = {
  teamId?: string
  slotId?: string
  role?: "leader" | "teammate"
}
```

为两个 Shape 增加 tldraw migration。`teamId/slotId` 是绑定标识，不把成员状态、任务或 Team Run 整体存入 Shape Props。

### 12.2 TeamStore

`TeamStore` 保存：

- Team Snapshot。
- `membersBySlotId`。
- 当前 Team Run 和 Slot Work。
- Task Snapshot。
- `lastSequence/connectionStatus/error`。

状态更新模式与现有 `ConversationStore` 保持一致：REST Prepare Replay + SSE Apply Event。

### 12.3 Shape Binding Controller

`team-shape-binding.ts` 负责后端与 tldraw 的幂等同步：

- `team.member.added`：不存在对应 `slotId` 时，在 Team Frame 内创建 Agent shape。
- `team.member.updated`：更新 title/role/provider 快照。
- `team.member.removed`：删除对应 Agent shape，但不再次调用 Conversation DELETE。
- Canvas 初始化：按 `teamId/slotId` 补建或清理 shape。

不要让 React Component 在 render 中直接修改 Editor；所有同步由 Controller 在 Effect/事件处理阶段完成。

### 12.4 删除语义改造

当前 Canvas 的 AfterDelete Handler 对所有 Agent 调用 `conversationController.destroy()`。改为：

```text
solo agent deleted
  -> DELETE conversation

team member user-deleted
  -> restore shape or route through Team member removal command

team member removed by backend event
  -> delete shape only

team frame deleted by user
  -> DELETE team; backend cascade owns member conversations
```

需要一个短生命周期的 programmatic deletion guard，防止后端事件触发 shape 删除后又发重复 DELETE。

### 12.5 ConversationWindow 提交策略

不要复制 Team 专属聊天窗口。给现有组件注入提交目标：

```ts
type ConversationSubmitTarget =
  | { kind: "conversation"; conversationId: string }
  | { kind: "team-member"; teamId: string; slotId: string; conversationId: string }
```

消息渲染和 Conversation SSE 完全复用，只有 Submit/Cancel Command 根据目标路由。

## 13. 依赖组装

当前代码直接导出多个 Singleton。新增 Team 前建议建立显式 `AppServices`：

```ts
type AppServices = {
  database: AppDatabase
  conversationRepository: ConversationRepository
  teamRepository: TeamRepository
  agentGateway: AgentGateway
  conversationService: ConversationService
  teamService: TeamService
}
```

组装顺序：

1. Database。
2. Repositories/Event Buses。
3. AgentGateway。
4. ConversationService。
5. Conversation Team Adapters。
6. TeamSessionRegistry/TeamService。
7. Routers。

测试通过传入 Memory SQLite 和 Fake Gateway 构建独立 Services，不依赖模块级 Singleton。

## 14. 安全与资源约束

- MCP 只监听 `127.0.0.1`，每 Team 使用随机高熵 Token。
- Tool Call 的 caller 身份来自桥接配置，不接受模型在参数中声明自己是谁。
- 每个 Tool 在服务端重复校验 caller role 和 target membership。
- 日志只记录 Team/Run/Slot/Tool/状态，不记录 Prompt、消息正文、附件或 Token。
- 限制每 Team 成员数、Mailbox 内容长度、任务数、广播 fan-out 和附件数量。
- Team Workspace 使用与现有附件相同的真实路径归一化和越界检查。
- MCP Error 返回稳定 domain code，不泄漏内部路径、命令或 Token。
- 删除 Team 前先取消运行，但数据库删除是最终事实；Runtime 清理失败记录告警，不恢复已删除 Team。

## 15. 测试策略

### 15.1 Contracts

- 创建 Team 的唯一 Leader、重复名称、非法 Provider。
- 所有 REST/SSE Payload 的 Zod round-trip。
- Team Event 类型与 Reducer 全覆盖。

### 15.2 Repository

- Team/Member 外键与级联删除。
- `clientMessageId` 幂等。
- Intent Claim 只有一个成功 Owner。
- Task 依赖不存在和环路拒绝。
- Team Event sequence 回放。

### 15.3 Service/Runtime

- 创建 Team 后每个成员获得独立 Conversation。
- 同 Slot 串行、不同 Slot 可并行。
- Agent 消息自动唤醒目标。
- 运行中到达的消息排队且下一批消费。
- Runtime Starting 时消息进入 Blocked/Queued，不丢失。
- Team Run 正确继承 Agent-to-Agent 工作并最终收敛。
- Cancel Team Run、Cancel Child Turn、Pause Slot 的迟到事件处理。
- 重启后 running Intent 恢复并 drain unread Mailbox。
- Leader 不能被删除或 shutdown。

### 15.4 MCP

- 未认证、错误 Token、伪造 Slot 拒绝。
- Teammate 看不到/不能调用 Leader-only Tool。
- Tool Schema 与 Authorization Registry 一致。
- stdio bridge 到 loopback TeamMcpServer 的真实集成测试。

### 15.5 Web

- REST Snapshot + SSE Replay 不重复状态。
- 动态 Spawn 自动创建且只创建一个 shape。
- Member Removed 删除 shape 但不重复删除 Conversation。
- Solo 删除行为保持不变。
- Team Member Composer 使用 Team endpoint。
- 页面刷新按 `canvasId/teamId/slotId` 正确水合。

### 15.6 最小 E2E

```text
Create Team with Leader + Worker
  -> Session Ready
  -> user sends Team goal
  -> Leader turn calls team_task_create + team_send_message
  -> Worker turn completes and reports to Leader
  -> Leader summarizes
  -> Team Run Completed
  -> restart server
  -> Team/Conversations/Tasks/Events remain queryable
```

## 16. 分阶段实施状态

### Phase 0：基础设施（已完成）

- 提升共享 Database 和 Migration Runner。
- 去除关键路径的模块级 Singleton，建立 AppServices。
- 给 Conversation 增加 Owner 和内部 Team Provisioning/Turn Port。
- 保证现有 Conversation 全量测试不回归。

### Phase 1：真实 Team 实体（已完成）

- Contracts、Team/Member 表、CRUD、Team SSE。
- Team Create Dialog、TeamStore、Shape Binding。
- Team-owned Conversation、唯一 Leader、删除语义。
- 此阶段完成“刷新不丢、画布与后端一致”。

### Phase 2：Team Session 与 MCP（已完成）

- TeamSessionRegistry、Member Runtime、Role/Wake Prompt。
- Acpx Runtime Factory 和 per-member MCP 配置。
- Mailbox、`team_send_message`、`team_members`。
- 此阶段完成真实 Agent-to-Agent 通信。

### Phase 3：Task 与 Team Run（核心已完成）

- Task Board、Work Intent、Member Event Loop、Team Run Manager。
- Team/Slot 状态、Run Snapshot、Team Run 取消、Activity UI。
- 持久化恢复与幂等发送。
- 成员级暂停留作后续。

### Phase 4：动态阵容（部分完成）

- `team_spawn_agent` 持久化审批、前端 Approve/Reject、动态 Shape。
- 并发增删成员和 Runtime attach 状态。
- Runner Catalog、Agent Profile 和 graceful shutdown 留作后续。

### Phase 5：生产加固

- Crash/timeout/rate-limit 分类。
- Watchdog、慢 Turn 提示、资源配额。
- Token/Cost 聚合、诊断日志和完整 E2E。

不要从 Phase 4 的动态 Spawn 开始。没有持久化 Team、Mailbox、Work Coordinator 和恢复时，Spawn 只会制造看似成功但不可调度的成员。

## 17. 实际修改面

| 现有文件                            | 改动                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| `packages/server/src/app.ts`        | 注册 Team Router，改为注入 AppServices                   |
| `packages/server/src/index.ts`      | 调整 migration/Team/Solo 恢复顺序和 shutdown             |
| `conversation.models.ts`            | 新增 Owner、Team Provisioning/Turn Port                  |
| `conversation.service.ts`           | Managed Conversation、Turn Completion、Solo-only restore |
| `agent.gateway.ts`                  | Session Context/MCP/Role Prompt 输入                     |
| `acpx-agent.gateway.ts`             | Runtime Factory、per-session Runtime Entry               |
| `sqlite-conversation.repository.ts` | 使用共享 DB，owner 字段，迁移外移                        |
| `packages/contracts/src/index.ts`   | 导出 teams contracts                                     |
| `canvas-page.tsx`                   | Team 创建、水合、Controller 连接、删除路由               |
| `agent-team-shape.tsx`              | `teamId` props、真实 Header/状态、migration              |
| `agent-shape.tsx`                   | `teamId/slotId/role` 绑定和提交目标                      |
| `conversation-window.tsx`           | 注入 Submit/Cancel Target，不复制窗口                    |
| `workspace-store.ts`                | 不存 Team 业务状态，仅保留 Canvas 本地偏好               |

新增代码主要落在 `contracts/teams`、`server/features/teams`、`web/features/teams`，避免把功能继续堆进 Canvas Page 或 Conversation Service。

## 18. 首个实施切片

建议第一个可合并切片严格限制为：

1. 共享 Database/Migration Runner。
2. Team/Member Contracts 与 Repository。
3. `POST/GET/DELETE /api/v1/teams`。
4. Team 创建时原子写入 Team、Member、Team-owned Conversation。
5. Web 创建对话框和 `teamId/slotId` Shape 绑定。
6. 刷新后按 `canvasId` 水合。
7. Solo/Team 删除语义测试。

这个切片暂不伪造 Agent 间协作，但把最难回头修改的身份、持久化和画布一致性边界先定稳。第二个切片再接 Role Prompt、MCP 和 Mailbox。
