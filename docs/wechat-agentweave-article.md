# 发现一款新型多 Agent 画布平台：AgentWeave

大家在使用 AI Agent 开发时，有没有遇到过这些问题？

平时同时使用 Codex、Claude Code、Pi 等多个 Agent 工具，哪个有额度就切到哪个。每个工具里又打开了多个项目、多个会话，时间一长，任务上下文散落得到处都是。

更麻烦的是，这些 Agent 之间彼此隔离：

- Codex 不知道 Claude Code 做了什么
- 不同项目和会话需要反复切换
- 很难让多个 Agent 围绕同一个任务协作
- Agent 生成的 PDF、Excel、Word、图片等产物散落在不同目录
- 想对照会话和文件时，需要在终端、编辑器与文件管理器之间来回切换

最近我发现了一个挺有意思的开源项目：**AgentWeave**。它尝试用一张可视化画布解决这些问题。

GitHub 项目地址：[bushm2092-del/agent-weave](https://github.com/bushm2092-del/agent-weave/tree/main)

## 为什么叫 Agent 画布？

AgentWeave 把每个 Agent 都看作画布上的一个节点。

你可以在同一张无限画布中添加 Codex、Claude Code、Pi、OpenCode 等不同类型的 Agent，并为每个 Agent 指定独立的工作区。

> 配图：`img/multi-agent-canvas.png`

每个 Agent 节点都拥有自己的：

- 对话记录
- 模型和运行模式
- 工作目录
- 工具调用过程
- 权限请求
- 上下文状态

这些节点可以在画布上自由移动、缩放和排列。你可以按照项目、任务或者职责组织它们，不需要在多个终端窗口和会话标签之间反复切换。

例如，一张画布可以同时放置：

- 一个 Codex Agent 负责实现功能
- 一个 Claude Code Agent 负责分析需求
- 一个 Reviewer Agent 负责代码审查
- 一个 Product Manager Agent 负责整理验收标准

整个项目的 AI 协作过程都集中在同一个空间里。

## 如何使用？

安装依赖并启动 Web 版本：

```bash
pnpm install
pnpm dev
```

默认访问地址：

```text
http://localhost:5173
```

也可以启动 Electron 桌面端：

```bash
pnpm dev:desktop
```

进入画布后，通过左侧工具栏新增 Agent，选择对应的 Provider 和工作目录，就可以直接开始对话。

> 配图：`img/agent-conversation.png`

目前支持的 Agent Provider 包括 Codex、Claude Code、Pi 和 OpenCode。项目通过 ACPX 与这些 Agent Runtime 通信，因此使用前仍然需要在本机完成相应工具的安装和认证。

## 如何使用 Agent Team？

除了独立 Agent，AgentWeave 还提供了 Agent Team 功能。

你可以创建一个由 Leader 和多个成员组成的团队，并为不同成员分配角色，例如：

- Leader：拆解目标并协调进度
- 前端工程师：实现页面和交互
- 后端工程师：实现接口和数据结构
- Reviewer：检查代码和潜在问题
- 产品经理：整理需求与验收标准

> 配图：`img/agent-team.png`

团队中的每个成员都有独立会话，同时可以共享工作区上下文。成员之间可以通过任务和消息机制协作，Leader 也可以跟踪成员状态、任务和活动记录。

这比单纯同时打开多个 Agent 更进一步：不只是把它们放在一个页面里，而是尝试让它们真正围绕同一个目标分工协作。

## 角色预设

如果经常创建相同类型的 Agent，还可以将角色保存为预设。

角色预设可以包含：

- 角色名称和职责
- Agent Provider
- System Prompt
- 默认工作方式
- 团队中的职责定位

> 配图：`img/role-presets.png`

组建新团队时，可以直接复用这些预设，不需要每次重新编写提示词，也能让不同项目中的同类角色保持一致。

## AI 产物可以直接放在画布中

Agent 生成的文件也可以作为预览节点放到画布上。

目前的设计目标是支持 PDF、Excel、Word、Markdown、文本、CSV 和图片等常见格式。文件预览节点可以调整大小，并在节点内部滚动查看内容。

> 配图：画布中的文件预览节点

这样，会话、Agent 和最终产物可以放在同一个上下文里。查看报告、表格或者设计稿时，不必频繁离开画布寻找文件。

不过文件预览仍处于开发阶段，不同格式的渲染完整度还有提升空间。

## 使用体验

从 GitHub 上的状态来看，AgentWeave 目前还处于早期开发阶段。实际体验中仍然能遇到一些问题，例如：

- 部分 Agent 的认证兼容性仍需完善
- 多 Agent 长时间运行的稳定性需要继续验证
- 文件预览格式还不够完整
- Agent Team 的任务调度和错误恢复仍有优化空间
- 桌面端安装和打包体验还需要打磨

因此，它暂时还不是一个可以完全替代现有 Agent 工具的成熟产品。

但我认为这个方向很有意思。

现在很多 AI 编程工具仍然以“单 Agent、单会话、单窗口”为核心，而真实的软件开发往往需要多个角色、多个上下文和大量中间产物。AgentWeave 试图把这些内容组织在一个空间化工作台里，为多 Agent 协作提供了另一种产品形态。

如果你也经常在 Codex、Claude Code 和多个项目之间切换，可以体验一下这个项目。它现在还比较早期，也意味着有很多可以参与和完善的空间。

感兴趣的开发者可以去 GitHub 查看源码、提交 Issue 或 PR，提前占个坑位。

## 加入交流群

欢迎扫码加入 AgentWeave 交流群，一起交流使用体验、问题反馈和后续规划。

![AgentWeave 微信交流群二维码](../img/agent-weave-wechat-group.jpg)
