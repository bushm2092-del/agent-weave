# AgentWeave Agent Team 产品交互方案

> 实现状态（2026-08-27）：核心 MVP 已落地。当前产品支持创建/恢复/删除 Team、手动增删成员、Team 目标、成员直接干预、Team Run 取消、只读 Task Board、Activity、MCP 协作和用户审批动态扩编。成员暂停、Session 手动启停和用户编辑 Task 留作后续。

## 1. 结论

AgentWeave 当前的 `Agent team` 只是一个 tldraw 画布容器：它能接收 Agent 子节点、显示成员数量，但没有后端 Team 实体、角色、团队任务、成员通信或统一运行状态。

建议把它升级为“后端 Team 实体在画布上的空间化投影”，而不是继续在 tldraw shape 内堆业务状态：

- 画布负责位置、尺寸、父子关系和选中态。
- 后端负责 Team、成员、Leader、Mailbox、Task Board、Team Run 和恢复。
- 每个成员继续拥有独立 Conversation，复用现有聊天窗口、消息流、权限确认和文件能力。
- 用户给团队下达目标时默认发给 Leader；用户也可以直接干预某个 Teammate。
- Agent 间协作通过内部 MCP 工具完成，浏览器不直接调用 MCP。

参考项目最值得复用的不是某个页面，而是这一产品分层：**用户对话、Agent 协作、团队运行状态分开建模**。

## 2. 现状与参考实现

### 2.1 AgentWeave 当前状态

当前实现具备：

- `New agent` 创建后端 Conversation 和对应画布 Agent。
- 每个 Conversation 有独立的串行 Run 队列。
- Conversation 通过可回放 SSE 推送初始化、流式内容、工具、权限和结束事件。
- `Agent team` 是可接收 Agent 子 shape 的 Frame，标题固定为 `Agent team`，副标题为 `Shared context`。
- 删除 Agent shape 会直接删除其后端 Conversation。

当前缺失：

- Team 后端实体和稳定 `teamId`。
- Leader/Teammate 角色、成员 `slotId` 和团队成员生命周期。
- Team 级输入、运行进度、取消、暂停、恢复。
- Agent 间消息、共享任务板和 MCP 工具。
- 后端动态增删成员后对画布的同步。
- Team 与 Canvas 的持久化关联。

### 2.2 pandora-core 当前代码事实

`pandora-core` 的实际代码已经比 `crates/aionui-team/docs/frontend-guide.md` 更先进。当前代码存在：

- Team CRUD、成员增删改、显式 Team 消息入口。
- Team Run 和每个 Slot 的工作状态。
- 用户消息、Agent 消息、恢复消息的因果归属。
- 每成员 Event Loop、持久化 Mailbox、Task Board。
- Team MCP Server、stdio bridge、角色 Prompt 注入。
- Team/Child Turn 的开始、完成、取消事件。
- Runtime attach、会话恢复、取消和暂停。

因此本方案以当前源码和测试为准，不采用旧文档中的“Team 不提供消息端点”“只有简单 Idle/Working 状态”等过时描述。

## 3. 产品模型

### 3.1 用户可见对象

| 对象     | 用户理解                                         | 核心标识                    |
| -------- | ------------------------------------------------ | --------------------------- |
| Canvas   | 一个空间化工作区                                 | `canvasId`                  |
| Team     | 为共同目标协作的一组 Agent                       | `teamId`                    |
| Member   | Team 中一个可独立对话和执行的 Agent              | `slotId` + `conversationId` |
| Leader   | 接收团队目标、拆解与调度的唯一成员               | `role=leader`               |
| Task     | 团队共享任务板中的工作项                         | `taskId`                    |
| Team Run | 从一次用户目标开始，到相关工作全部收敛的一次运行 | `teamRunId`                 |

### 3.2 三种状态必须分开

不要把所有状态压成 Agent 卡片上的一个 `status`：

| 状态维度     | 示例                                                    | 解决的问题                  |
| ------------ | ------------------------------------------------------- | --------------------------- |
| Session 状态 | `starting / ready / failed / stopped`                   | Team 协作基础设施能否使用   |
| Runtime 状态 | `pending / ready / failed / removing`                   | 某个成员的 ACP 进程是否可用 |
| Work 状态    | `idle / queued / starting / running / paused / blocked` | 某个成员当前是否有团队工作  |

卡片上只显示一个“有效状态”，优先级为：`failed > blocked > running > starting > queued > paused > ready`。完整原因放在 Team Inspector 中。

## 4. 信息架构

### 4.1 Canvas 第一视图

Team 仍然是一个可移动、可缩放的 Frame，成员 Agent 仍是其子节点。Team Header 从装饰标题升级为控制面：

```text
┌────────────────────────────────────────────────────────────────────┐
│ Code review team   Ready   3 members   2/4 tasks   [Run…] [···]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌──────── Leader ────────┐   ┌────── Reviewer ──────┐           │
│   │ conversation window   │   │ conversation window   │           │
│   └───────────────────────┘   └────────────────────────┘           │
│                                                                    │
│   ┌──────── Tester ────────┐                                      │
│   │ conversation window   │                                      │
│   └───────────────────────┘                                      │
└────────────────────────────────────────────────────────────────────┘

Selected Team -> right-side Inspector
┌──────────────────────────────┐
│ Members | Tasks | Activity   │
│ ...                          │
└──────────────────────────────┘
```

Team Header 只显示可扫描信息：

- Team 名称。
- Team Session/Run 的有效状态。
- 成员数。
- 任务完成数。
- 团队目标输入按钮。
- 更多菜单：重命名、添加成员、停止 Session、删除 Team。

当前文案 `Shared context` 应改为 `Shared workspace`。参考实现并不是把所有成员的完整 LLM 上下文合并，而是共享 Workspace、Mailbox 和 Task Board；继续称为 Shared context 会形成错误预期。

### 4.2 Team Inspector

Inspector 使用三个 Tab，不把复杂团队信息塞进 Header：

| Tab      | 内容                                            | MVP |
| -------- | ----------------------------------------------- | --: |
| Members  | 角色、Provider、Runtime/Work 状态、重命名、移除 |  是 |
| Tasks    | Subject、Owner、Status、Blocked by；MVP 可只读  |  是 |
| Activity | Team Run、Child Turn、成员增删、错误和恢复事件  |  是 |

任务板在 MVP 可以“Agent 可写、用户只读”。后续再开放用户创建、改派和完成任务，避免首版同时引入两套任务写入规则。

## 5. 核心交互流程

### 5.1 创建 Team

点击 `Agent team` 不再立即生成空 Frame，而是打开创建对话框：

1. 输入 Team 名称。
2. 选择共享 Workspace，默认当前 Canvas Workspace。
3. 创建一个 Leader：名称、Runner、可选 Model。
4. 可选添加初始 Teammate。
5. 点击 `Create team`。

提交后：

1. 前端调用 `POST /api/v1/teams`。
2. 后端一次创建 Team、成员记录和每个成员的 Team-owned Conversation。
3. 前端创建带 `teamId` 的 Team shape，并为返回成员创建带 `slotId/conversationId` 的 Agent shape。
4. Team Header 显示 `Starting`，成员卡片分别显示 `Starting`。
5. Team SSE 收到 Session/Runtime Ready 后切为可运行状态。

创建失败时不得留下只有画布、没有后端实体的 Team。若后端已创建但画布写入失败，前端保留 Team，并在重新进入 Canvas 时根据 `canvasId` 重新水合。

### 5.2 给 Team 下达目标

用户从 Team Header 的 `Run` 按钮打开紧凑输入框，或者在 Leader 卡片内发送：

1. 调用 `POST /api/v1/teams/{teamId}/messages`。
2. 后端返回 `teamRunId`、`messageId` 和入队状态。
3. Team Header 显示 `Running`，Inspector Activity 增加该 Run。
4. Leader 的 Conversation 正常显示用户消息和流式回复。
5. Leader 通过 MCP 创建任务、给 Teammate 发消息。
6. Teammate Agent 卡片依次显示 `Queued/Running/Ready`。
7. 所有属于该 Run 的因果工作完成后，Team Run 进入 `Completed`。

Team 输入不是群聊广播。默认只发送给 Leader，由 Leader 决定如何拆解和分发。

### 5.3 直接干预成员

用户仍可在任意成员的 Conversation Window 输入：

- Solo Agent：继续调用现有 Conversation Run API。
- Team Member：改为调用 `POST /api/v1/teams/{teamId}/members/{slotId}/messages`。

这样后端可以把直接消息纳入 Team Run 的因果链，而不是绕过 Team 调度器。

如果当前已有 Team Run，该消息标记为 `user_intervention` 并归入当前 Run；没有活动 Run 时，创建一个以该成员为目标的新 Run。

UI 不需要增加额外确认，但应在 Activity 中标记“Direct intervention”。

### 5.4 Leader 提议扩编

动态扩编分两回合：

1. Leader 在协作过程中调用 `team_spawn_agent` 提交名称、Runner 和可选 Model。
2. 后端只持久化 `pending` Spawn Request，不创建成员或 Runtime。
3. Team Inspector 显示审批项，用户选择 Approve 或 Reject。
4. Approve 后后端才创建 Team Member 和 Team-owned Conversation；Reject 不产生 Runtime。
5. 前端收到 `team.spawn.resolved` 和 `team.member.added`，同步审批状态并在 Team Frame 内创建 Agent shape。
6. Runtime Ready 后，新成员才能消费后续任务。

这是明确的产品审批门槛。创建 Team 时服务端返回只显示一次的 Team Control Capability，浏览器按 `teamId` 持有，服务端只保存哈希；Approve/Reject、成员管理、删除和用户消息都必须携带该 capability。成员 Runtime 只收到自己的 MCP Token，不会收到宿主控制令牌。它隔离了普通 Agent 工具与宿主操作，但仍不是独立操作系统用户、进程沙箱或远程多租户认证的替代品。

AgentWeave 当前没有 AionUi 的 Assistant Catalog，因此首版不要照搬“assistant-first”参数。建议首版使用现有 Runner Provider；等 Agent Profile/Assistant Catalog 建立后再切换为 Profile ID。

### 5.5 手动添加成员

从 Team Header 或 Members Tab 点击添加：

1. 输入名称。
2. 选择 Runner。
3. 选择可选 Model。
4. 后端创建新的 Team-owned Conversation。
5. Team 中新增 Agent 卡片并显示 Runtime 启动状态。
6. Leader 收到系统消息，得知阵容变化。

不支持添加第二个 Leader。

### 5.6 移除成员

成员菜单选择移除：

- Leader 不可移除，除非删除整个 Team。
- 正在运行的成员先显示确认：移除会取消该成员当前 Child Turn。
- 确认后，后端依次取消工作、停止 Runtime、从 Team 移除、删除 Team-owned Conversation。
- 前端以 `team.member.removed` 事件为准删除 Agent shape。
- Leader 收到阵容变化消息，避免继续向旧 `slotId` 分派。

Leader 通过 MCP 发起的 graceful shutdown 保留“请求、成员批准/拒绝、批准后移除”的协议；用户从 UI 强制移除不需要等待 Agent 自己批准。

### 5.7 拖入已有 Solo Agent

不能把当前“拖进 Frame 就算入队”直接保留为真实 Team 行为，原因有两个：

- Team Agent 需要在 ACP `session/new` 时注入角色 Prompt 和 MCP Server。
- acpx 的 system prompt 对已复用的持久 Session 不会重新生效。

因此 Solo Agent 拖入 Team 时弹出选择：

| 选择               | 行为                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| Add a copy to team | 以相同 Runner/Workspace 新建 Team Member；原 Solo Agent 保留。推荐默认项 |
| Cancel             | 恢复到原位置                                                             |

不要首版提供“直接转换并保留原对话”，因为它会造成旧 Session 没有 Team MCP、历史和角色身份又看似连续的伪成功状态。

### 5.8 拖出 Team Member

拖出不等于退出 Team。成员 shape 在 Team 内的父子关系是后端成员关系的投影，拖出后应回弹，并提示通过成员菜单执行 `Remove from team`。

这条规则避免画布层级和后端 Team 成员列表分叉。

### 5.9 取消与暂停

Team Header 在活动 Run 期间提供 Stop 图标：

- Stop Team Run：取消当前 Run 关联的所有 queued/running work。

取消成功以后，已生成的 Conversation 内容保留；未执行 Mailbox 消息标记为已终止，不在下一次 Run 中被意外消费。

成员级 Stop/Pause 需要额外的队列保留与恢复语义，作为后续扩展，不在当前 MVP 中伪装成可用能力。

### 5.10 重启与恢复

重新进入 Canvas：

1. `GET /api/v1/teams?canvasId=...` 获取后端 Team。
2. 对每个 Team 获取快照，并连接 Team SSE。
3. Canvas 中已有 shape 时按 `teamId/slotId` 对齐；缺失时补建，多余时移除。
4. 后端将中断的 Running Work 恢复为 Queued，再消费未读 Mailbox。
5. 前端先用 REST 快照显示状态，再用 SSE 增量更新，不能只依赖实时事件。

## 6. 状态与反馈

### 6.1 Team Header 状态

| 状态       | 展示                | 可执行动作                    |
| ---------- | ------------------- | ----------------------------- |
| Starting   | 进度指示            | 查看详情、删除                |
| Ready      | Ready               | Run、添加成员                 |
| Running    | 运行指示 + 任务进度 | Stop、直接干预                |
| Cancelling | Cancelling          | 等待，不重复取消              |
| Failed     | Failed              | Retry session、查看错误、删除 |
| Stopped    | Stopped             | Start session                 |

### 6.2 消息入队状态

发送后立即展示用户消息，后端 ACK 决定辅助状态：

| ACK                        | UI                                       |
| -------------------------- | ---------------------------------------- |
| `accepted`                 | 正常进入运行                             |
| `queued`                   | 消息旁显示 Queued                        |
| `blocked_runtime_starting` | 显示 Waiting for agent，并保持消息不丢失 |

### 6.3 错误原则

- Mailbox 已持久化但唤醒失败时，不向用户伪装成“发送失败”并诱导重复提交；显示 Queued/Waiting。
- 所有发送请求携带稳定 `clientMessageId`，重试必须幂等。
- Team Session 失败与单个 Member Runtime 失败分开显示。
- Team 运行失败不删除已完成成员的结果。

## 7. API 与事件的产品边界

### 7.1 REST

| 操作             | 建议端点                                                    |
| ---------------- | ----------------------------------------------------------- |
| Team CRUD        | `/api/v1/teams`、`/api/v1/teams/{teamId}`                   |
| Member CRUD      | `/api/v1/teams/{teamId}/members/**`                         |
| 给 Leader 发目标 | `POST /api/v1/teams/{teamId}/messages`                      |
| 直接干预成员     | `POST /api/v1/teams/{teamId}/members/{slotId}/messages`     |
| Team Run 快照    | `GET /api/v1/teams/{teamId}` 的 `activeRun`，历史用 `/runs` |
| 取消 Team Run    | `POST /api/v1/teams/{teamId}/runs/{runId}/cancel`           |
| 任务快照         | `GET /api/v1/teams/{teamId}` 的 `tasks`                     |
| Spawn 审批       | `POST .../spawn-requests/{requestId}/approve` 或 `/reject`  |

### 7.2 Team SSE

AgentWeave 已经采用可回放 SSE，新增 Team SSE 比引入 WebSocket 更一致：

```text
GET /api/v1/teams/{teamId}/events?after={sequence}
```

首版事件：

- `team.created/updated/deleted`
- `team.session.updated`
- `team.member.added`
- `team.member.updated`
- `team.member.removed`
- `team.task.created/updated`
- `team.spawn.requested/resolved`
- `team.run.accepted/started/updated/completed/cancelled/failed`
- `team.child-turn.queued/started/completed/cancelled/failed`

Conversation 的流式文本继续走现有 Conversation SSE，Team SSE 不重复传输 Token Delta。

## 8. MVP 范围

### 8.1 第一版必须包含

- 后端 Team/Member 实体和 Canvas 绑定。
- 创建 Team，唯一 Leader，手动增删 Teammate。
- Team-owned Conversation 和 Team 角色 Prompt。
- Team 级目标、成员直接干预、Team Run/Slot 状态。
- Mailbox、任务板、Agent 间 `team_send_message`。
- Team SSE 快照 + 回放。
- Team Frame 与后端成员双向一致。
- 取消 Team Run；成员级暂停/取消留作后续。
- 重启恢复和幂等发送。
- Leader Spawn Request 与用户 Approve/Reject。

### 8.2 后续版本

- Graceful Shutdown 和成员级暂停/取消。
- Agent Profile/Assistant Catalog。
- 用户可编辑 Task Board。
- 成本/Token 聚合和并发预算。
- Team 模板与阵容复用。

## 9. 验收标准

1. 创建 Team 后刷新页面，Team 和成员不会丢失或重复。
2. Team 中每个成员有独立 Conversation，但共享 Workspace、Mailbox 和 Task Board。
3. 用户给 Leader 一个目标后，能看到 Team Run、Leader 和 Teammate 的独立状态变化。
4. Agent 间消息能自动唤醒目标成员，不需要用户再次发消息。
5. 运行中的成员收到后续消息时，消息可靠排队且不丢失。
6. 删除/取消操作不会让后端成员和画布 shape 分叉。
7. 服务重启后，未完成工作恢复为可继续或明确失败，不永久卡在 Running。
8. Solo Agent 的现有创建、聊天、权限、取消和删除行为不回归。

## 10. 关键产品决策

| 决策                                   | 选择                    | 原因                                                        |
| -------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| Team 是画布对象还是后端对象            | 后端对象，画布只投影    | 支持恢复、动态成员和跨页面一致性                            |
| Team 输入发给谁                        | 默认 Leader             | 避免无控制广播和重复执行                                    |
| Team 文本流走哪里                      | 继续走 Conversation SSE | 复用现有聊天和流式渲染                                      |
| Team 状态事件走哪里                    | 新增 Team SSE           | 与当前栈一致，支持 sequence 回放                            |
| 既有 Solo Conversation 能否直接入 Team | 首版不能                | MCP/System Prompt 必须在新 Session 注入                     |
| Task Board 首版谁能写                  | Agent 写，用户只读      | 保持单一调度来源，控制首版复杂度                            |
| 是否照搬 Assistant-first Spawn         | 暂不                    | AgentWeave 目前只有 Runner Provider，没有 Assistant Catalog |
