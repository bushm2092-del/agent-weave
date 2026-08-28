import { resolve } from "node:path"
import { z } from "zod"

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3_001),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  ACPX_STATE_DIR: z.string().min(1).default(".agent-weave/acpx"),
  ACPX_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  DATABASE_PATH: z.string().min(1).default(".agent-weave/agent-weave.db"),
})

const parsedEnvironment = environmentSchema.parse(process.env)

export const environment = {
  nodeEnv: parsedEnvironment.NODE_ENV,
  host: parsedEnvironment.HOST,
  port: parsedEnvironment.PORT,
  corsOrigins: parsedEnvironment.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  acpxStateDir: resolve(parsedEnvironment.ACPX_STATE_DIR),
  acpxTimeoutMs: parsedEnvironment.ACPX_TIMEOUT_MS,
  databasePath: resolve(parsedEnvironment.DATABASE_PATH),
}
