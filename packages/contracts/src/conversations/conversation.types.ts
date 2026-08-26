import { z } from "zod"

export const agentProviderSchema = z.enum(["claude", "codex", "pi", "opencode"])

export type AgentProvider = z.infer<typeof agentProviderSchema>

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedReadTokens: z.number().int().nonnegative().optional(),
  cachedWriteTokens: z.number().int().nonnegative().optional(),
  thoughtTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>
