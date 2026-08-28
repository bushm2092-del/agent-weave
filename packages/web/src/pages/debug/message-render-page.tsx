import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"

import { MarkdownMessage } from "@/components/markdown"
import { MessageRender, type MessageRenderData } from "@/features/conversations"

const streamdownMock = `## Streamdown 独立组件

这部分不经过 \`MessageRender\`，用于检查 Streamdown 自身的渲染结果。

| 类型 | 示例 |
| --- | --- |
| 强调 | **重要内容** |
| 代码 | \`pnpm typecheck\` |
| 中文 | 支持 CJK 标点与换行 |

\`\`\`ts
const status = "ready"
console.log(status)
\`\`\``

const eventComposedMessages: MessageRenderData[] = [
  {
    id: "event-user",
    role: "user",
    content: "检查一下 Markdown 组件的接入情况，并告诉我需要修改什么。",
  },
  {
    id: "event-assistant",
    role: "assistant",
    status: "completed",
    usage: { inputTokens: 386, outputTokens: 724 },
    parts: [
      {
        id: "event-intro",
        type: "markdown",
        content: "我先检查组件入口和当前样式引用。",
      },
      {
        id: "event-thought-1",
        type: "thought",
        content: "需要确认 Streamdown 是否通过统一入口导出，以及样式是否由应用入口加载。",
      },
      {
        id: "event-tool-1",
        type: "tool",
        tool: {
          id: "event-read-files",
          runId: "event-run",
          title: "已读取 Markdown 组件",
          kind: "read",
          status: "completed",
          rawInput: { path: "src/components/markdown" },
          rawOutput: ["index.tsx", "streamdown.css"],
        },
      },
      {
        id: "event-analysis",
        type: "markdown",
        content: `组件入口已经存在，但消息数据应先在前端组合成有序结构：

1. 文本增量合并为相邻的 \`markdown\` part
2. 工具调用保留在它出现的位置
3. 后续文本继续追加为新的 part`,
      },
      {
        id: "event-tool-2",
        type: "tool",
        tool: {
          id: "event-typecheck",
          runId: "event-run",
          title: "pnpm typecheck",
          kind: "command",
          status: "completed",
          rawInput: { command: "pnpm --filter @agent-weave/web typecheck" },
          rawOutput: "Type check passed",
        },
      },
      {
        id: "event-result",
        type: "markdown",
        content: `修改已完成。现在同一条 AI 消息可以按真实事件顺序展示：

\`Markdown → Thought → Tool → Markdown → Tool → Markdown\``,
      },
    ],
  },
]

const messages: MessageRenderData[] = [
  { id: "user-short", role: "user", content: "请展示一份支持 Markdown 的项目状态报告。" },
  {
    id: "assistant-rich",
    role: "assistant",
    status: "completed",
    usage: { inputTokens: 842, outputTokens: 1260 },
    parts: [
      {
        id: "assistant-rich-intro",
        type: "markdown",
        content: `# 项目状态

Streamdown 已接入，当前支持：

- **GitHub Flavored Markdown** 与中文标点
- 行内代码 \`pnpm typecheck\`
- 表格、代码高亮、数学公式和 Mermaid

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Markdown | 完成 | 支持流式内容 |
| CJK | 完成 | 中文强调与换行 |
| Code | 完成 | Shiki 高亮 |`,
      },
      {
        id: "assistant-rich-thought",
        type: "thought",
        content: "确认 Markdown 渲染状态，并读取组件目录。",
      },
      {
        id: "assistant-rich-tool",
        type: "tool",
        tool: {
          id: "debug-read",
          runId: "debug-run",
          title: "已读取 components/markdown",
          status: "completed",
          rawInput: { path: "src/components/markdown" },
          rawOutput: ["index.tsx", "streamdown.css"],
        },
      },
      {
        id: "assistant-rich-result",
        type: "markdown",
        content: `消息卡片由同一个 \`MessageRender\` 组件继续渲染。

\`\`\`tsx
<MessageRender
  message={{
    id: "demo",
    role: "assistant",
    parts: [{ id: "text", type: "markdown", content: "**Hello**" }],
    status: "completed",
  }}
/>
\`\`\`

数学公式：$E = mc^2$

\`\`\`mermaid
flowchart LR
  Data[Message data] --> Render[MessageRender]
  Render --> Markdown[Streamdown]
  Render --> Card[Message card]
\`\`\``,
      },
    ],
  },
  {
    id: "assistant-streaming",
    role: "assistant",
    status: "running",
    parts: [
      {
        id: "assistant-streaming-text",
        type: "markdown",
        content: "正在生成回复，未闭合的 Markdown 也应该保持稳定：\n\n- 第一项\n- **正在输入",
      },
    ],
  },
  { id: "assistant-working", role: "assistant", status: "running", parts: [] },
  { id: "assistant-error", role: "assistant", status: "failed", parts: [], error: "模型连接暂时不可用。" },
]

export function MessageRenderPage() {
  return (
    <main className="message-render-debugger">
      <header className="message-render-debugger__header">
        <Link to="/" aria-label="Back to AgentWeave">
          <ArrowLeft />
        </Link>
        <div>
          <strong>MessageRender</strong>
          <span>Production component mocks</span>
        </div>
      </header>
      <section className="message-render-debugger__stage">
        <div className="message-render-debugger__section-label">Event-composed AI message</div>
        <div className="message-render-debugger__conversation message-render-debugger__conversation--compact">
          {eventComposedMessages.map((message) => (
            <MessageRender key={message.id} message={message} />
          ))}
        </div>
        <div className="message-render-debugger__section-label">Message states</div>
        <div className="message-render-debugger__conversation">
          {messages.map((message) => (
            <MessageRender key={message.id} message={message} />
          ))}
        </div>
        <div className="message-render-debugger__section-label">Streamdown</div>
        <div className="message-render-debugger__streamdown">
          <MarkdownMessage streaming={false}>{streamdownMock}</MarkdownMessage>
        </div>
      </section>
    </main>
  )
}
