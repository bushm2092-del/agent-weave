import { z } from "zod"

export const agentProviderSchema = z.enum(["claude", "codex", "pi", "opencode"])

export type AgentProvider = z.infer<typeof agentProviderSchema>

export const conversationStatusSchema = z.enum(["initializing", "ready", "running", "failed"])

export const sessionStateSchema = z.enum(["pending", "created", "resumed"])

const configSelectValueSchema = z.object({
  value: z.string(),
  name: z.string(),
  description: z.string().optional(),
})

const configSelectGroupSchema = z.object({
  group: z.string(),
  options: z.array(configSelectValueSchema),
})

export const agentConfigOptionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    type: z.literal("select"),
    currentValue: z.string(),
    options: z.union([z.array(configSelectValueSchema), z.array(configSelectGroupSchema)]),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    type: z.literal("boolean"),
    currentValue: z.boolean(),
  }),
])

export const conversationSchema = z.object({
  id: z.string().uuid(),
  agent: agentProviderSchema,
  workspace: z.string(),
  status: conversationStatusSchema,
  sessionState: sessionStateSchema,
  configOptions: z.array(agentConfigOptionSchema),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type AgentConfigOption = z.infer<typeof agentConfigOptionSchema>
export type Conversation = z.infer<typeof conversationSchema>
export type ConversationStatus = z.infer<typeof conversationStatusSchema>
export type SessionState = z.infer<typeof sessionStateSchema>

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedReadTokens: z.number().int().nonnegative().optional(),
  cachedWriteTokens: z.number().int().nonnegative().optional(),
  thoughtTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>
