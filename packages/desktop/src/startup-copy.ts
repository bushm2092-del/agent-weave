export function startupFailureCopy(locale: string): { title: string; messagePrefix: string } {
  if (locale.toLowerCase().startsWith("zh")) {
    return {
      title: "AgentWeave 启动失败",
      messagePrefix: "AgentWeave 无法启动。诊断信息：\n\n",
    }
  }

  return {
    title: "AgentWeave failed to start",
    messagePrefix: "AgentWeave could not start. Diagnostic details:\n\n",
  }
}
